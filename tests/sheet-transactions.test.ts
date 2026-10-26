import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { JWT } from "google-auth-library";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { cells, TABLES } from "../lib/sheets";
import { fixture, manager, member, now } from "./fixture";
import { acceptInvitation, planFormRequest, planInvitation } from "../lib/invitations";
import { upgradeStore, recordChanges } from "../lib/collaboration";
import { commitSheetTransaction } from "../lib/sheet-transactions";
const key="test-writer-secret-with-at-least-32-characters";
const originalFetch=globalThis.fetch,originalToken=JWT.prototype.getAccessToken;
const envKeys=["SHEETS_TRANSACTION_KEY","SHEETS_TRANSACTION_URL","GOOGLE_SHEET_ID","GOOGLE_SERVICE_ACCOUNT_EMAIL","GOOGLE_PRIVATE_KEY"];
const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
after(()=>{globalThis.fetch=originalFetch;JWT.prototype.getAccessToken=originalToken;for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
function writer() {
  const tables=new Map<string,string[][]>(Object.entries(TABLES).map(([name,headers])=>[name,[[...headers]]]));
  tables.set("LabRevision",[["id","version"],["lab","0"]]);
  let locked=false,failBatch=false,commits=0;
  const tabs=[...tables.keys()];
  type CellRequest = {updateCells?: {range: {sheetId:number;startRowIndex:number;endRowIndex:number;endColumnIndex:number};rows:{values:{userEnteredValue:{stringValue:string}}[]}[]}};
  const context=createContext({
    LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:(k:string)=>k==="TRANSACTION_KEY" ? key : "test-sheet"})},
    Utilities:{computeHmacSha256Signature:(payload:string,secret:string)=>[...createHmac("sha256",secret).update(payload).digest()]},
    SpreadsheetApp:{openById:()=>({getSheetByName:(name:string)=>tables.has(name) ? {
      getSheetId:()=>tabs.indexOf(name),getLastRow:()=>tables.get(name)!.length,getMaxRows:()=>1000,
      getRange:(row:number,col:number,numRows:number,numCols:number)=>({getValues:()=>Array.from({length:numRows},(_,i)=>Array.from({length:numCols},(_,j)=>tables.get(name)![row+i-1]?.[col+j-1] ?? ""))}),
    } : null})},
    Sheets:{Spreadsheets:{batchUpdate:({requests}:{requests:CellRequest[]})=>{
      if(failBatch)throw new Error("Simulated atomic batch failure");
      const next=structuredClone(tables);
      for(const request of requests){if(!request.updateCells)continue;const {range,rows}=request.updateCells;const name=tabs[range.sheetId];const data=next.get(name)!;
        for(let r=range.startRowIndex;r<range.endRowIndex;r++){data[r]??=[];for(let c=0;c<range.endColumnIndex;c++)data[r][c]=rows[r-range.startRowIndex]?.values[c]?.userEnteredValue.stringValue ?? "";}
      }
      tables.clear();for(const [name,rows] of next)tables.set(name,rows);commits++;
    }}},
    ContentService:{MimeType:{JSON:"json"},createTextOutput:(value:string)=>({setMimeType:()=>JSON.parse(value)})},
  });
  runInContext(readFileSync(new URL("../docs/sheets-transaction-writer.gs",import.meta.url),"utf8"),context);
  return { tables, setFailure:(fail:boolean)=>{failBatch=fail;},commits:()=>commits, request:(body:string)=>runInContext(`doPost(${JSON.stringify({postData:{contents:body}})})`,context) };
}
function states(){const before=upgradeStore(fixture()),next=structuredClone(before);next.projects[0].name="Audited change";recordChanges(before,next,member,"Project","Updated project",now);next.revision=1;return{before,next};}
function configure(w:ReturnType<typeof writer>){Object.assign(process.env,{SHEETS_TRANSACTION_KEY:key,SHEETS_TRANSACTION_URL:"https://script.google.com/macros/s/test-deployment/exec",GOOGLE_SHEET_ID:"test-sheet"});globalThis.fetch=async(_url,init)=>new Response(JSON.stringify(w.request(String(init?.body))),{status:200});}
test("the locked writer atomically persists the changed record, new audit and revision; stale retries commit nothing",async()=>{
  const w=writer();configure(w);const {before,next}=states();await commitSheetTransaction(before,next);
  assert.equal(w.tables.get("LabProjects")![1][1],"Audited change");assert.equal(w.tables.get("LabActivity")![1][4],member.personId);assert.equal(w.tables.get("LabRevision")![1][1],"1");assert.equal(w.commits(),1);
  await assert.rejects(commitSheetTransaction(before,next),/while saving/);assert.equal(w.commits(),1);assert.equal(w.tables.get("LabActivity")!.length,2);
});
test("the locked writer stores invitations, accepted memberships and form requests together", async () => {
  const w = writer(); configure(w);
  const before = upgradeStore(fixture()), invited = structuredClone(before);
  const invitationId = "55555555-5555-4555-8555-555555555555";
  planInvitation(invited, manager, { id: invitationId, email: manager.email, projectId: invited.projects[0].id }, now);
  invited.revision = 1;
  await commitSheetTransaction(before, invited);
  assert.equal(w.tables.get("LabInvitations")![1][1], manager.email);
  const accepted = structuredClone(invited);
  acceptInvitation(accepted, manager, invitationId, now);
  planFormRequest(accepted, manager, { action: "request", id: "66666666-6666-4666-8666-666666666666", projectId: accepted.projects[0].id, personIds: [member.personId], kind: "initiation", message: "Complete the goal" }, now);
  recordChanges(invited, accepted, manager, "Forms", "Requested initiation form", now);
  accepted.revision = 2;
  await commitSheetTransaction(invited, accepted);
  assert.equal(w.tables.get("LabInvitations")![1][6], now.toISOString());
  assert.ok(w.tables.get("LabMemberships")!.some(row => row[2] === manager.personId));
  const requests = JSON.parse(w.tables.get("LabProjects")![1].at(-1)!);
  assert.equal(requests[0].personId, member.personId); assert.equal(requests[0].message, "Complete the goal");
  assert.equal(w.tables.get("LabRevision")![1][1], "2");
});
test("an audit/batch write failure leaves no changed project, revision or successful activity",async()=>{
  const w=writer();configure(w);w.setFailure(true);const {before,next}=states();await assert.rejects(commitSheetTransaction(before,next),/could not confirm/);
  assert.equal(w.tables.get("LabProjects")!.length,1);assert.equal(w.tables.get("LabActivity")!.length,1);assert.equal(w.tables.get("LabRevision")![1][1],"0");assert.equal(w.commits(),0);
  w.setFailure(false);await commitSheetTransaction(before,next);assert.equal(w.commits(),1);
});
test("unsigned, expired and wrong-spreadsheet requests cannot enter the writer",async()=>{
  const w=writer();configure(w);let body="";globalThis.fetch=async(_url,init)=>{body=String(init?.body);return new Response(JSON.stringify({ok:true,revision:1}));};const {before,next}=states();await commitSheetTransaction(before,next);
  const envelope=JSON.parse(body);assert.equal(w.request(JSON.stringify({...envelope,signature:"0".repeat(64)})).ok,false);
  for(const change of [{issuedAt:0},{sheetId:"another-lab"}]){const payload=JSON.stringify({...JSON.parse(envelope.payload),...change});assert.equal(w.request(JSON.stringify({payload,signature:createHmac("sha256",key).update(payload).digest("hex")})).ok,false);}
  assert.equal(w.commits(),0);
});
test("duplicate IDs and invalid audit cell values reject the whole transaction",async()=>{
  const w=writer();configure(w);const {before,next}=states();next.memberships.push({...next.memberships[0]});await assert.rejects(commitSheetTransaction(before,next));assert.equal(w.commits(),0);
  next.memberships.pop();next.activities[0].changes[0].after="x".repeat(46000);await assert.rejects(commitSheetTransaction(before,next));assert.equal(w.commits(),0);
});
test("RAW stringValue writes preserve literal formulas and multiline project content",async()=>{
  const w=writer();configure(w);const {before,next}=states();next.projects[0].goal="=literal formula\nSecond line";await commitSheetTransaction(before,next);assert.equal(w.tables.get("LabProjects")![1][2],next.projects[0].goal);
});
test("new transactions cannot reuse or alter a historical activity ID",async()=>{
  const w=writer();configure(w);const {before,next}=states();await commitSheetTransaction(before,next);
  const following=structuredClone(next);following.projects[0].name="Another change";recordChanges(next,following,member,"Project","Updated project",now);following.activities.at(-1)!.id=next.activities[0].id;
  await assert.rejects(commitSheetTransaction(next,following),/could not confirm/);assert.equal(w.commits(),1);assert.equal(w.tables.get("LabProjects")![1][1],"Audited change");assert.equal(w.tables.get("LabActivity")!.length,2);
});
function sheetsApi(){
  const tables=new Map<string,string[][]>(Object.entries(TABLES).map(([name,headers])=>[name,[[...headers]]]));
  tables.set("LabRevision",[["id","version"],["lab","0"]]);
  const tabs=[...tables.keys()];let commits=0;
  for(const k of envKeys)delete process.env[k];
  Object.assign(process.env,{GOOGLE_SHEET_ID:"test-sheet",GOOGLE_SERVICE_ACCOUNT_EMAIL:"unit@test.invalid",GOOGLE_PRIVATE_KEY:"not-a-real-key"});
  JWT.prototype.getAccessToken=async()=>({token:"unit-test-token",res:null});
  globalThis.fetch=async(input,init)=>{
    const url=decodeURIComponent(String(input));
    if(url.includes("?fields="))return new Response(JSON.stringify({sheets:tabs.map((title,sheetId)=>({properties:{sheetId,title,gridProperties:{rowCount:1000}}}))}));
    if(url.includes("values:batchGet"))return new Response(JSON.stringify({valueRanges:[...url.matchAll(/ranges='([^']+)'/g)].map(m=>({values:tables.get(m[1])}))}));
    if(url.endsWith(":batchUpdate")){
      for(const {updateCells:u} of JSON.parse(String(init?.body)).requests){if(!u)continue;const data=tables.get(tabs[u.range.sheetId])!;
        for(let r=u.range.startRowIndex;r<u.range.endRowIndex;r++){data[r]??=[];for(let c=0;c<u.range.endColumnIndex;c++)data[r][c]=u.rows[r-u.range.startRowIndex]?.values[c]?.userEnteredValue.stringValue ?? "";}}
      commits++;return new Response("{}");
    }
    throw new Error("Unexpected storage request "+url);
  };
  return {tables,commits:()=>commits};
}
test("without the locked writer, saves commit directly in one batch instead of blocking members",async()=>{
  const s=sheetsApi();const {before,next}=states();await commitSheetTransaction(before,next);
  assert.equal(s.commits(),1);assert.equal(s.tables.get("LabProjects")![1][1],"Audited change");assert.equal(s.tables.get("LabActivity")!.length,2);assert.equal(s.tables.get("LabRevision")![1][1],"1");
  await assert.rejects(commitSheetTransaction(before,next),/while saving/);assert.equal(s.commits(),1);assert.equal(s.tables.get("LabActivity")!.length,2);
});
test("the direct fallback refuses duplicate IDs without writing",async()=>{
  const s=sheetsApi();const {before,next}=states();next.memberships.push({...next.memberships[0]});
  await assert.rejects(commitSheetTransaction(before,next),/not applied/);assert.equal(s.commits(),0);
});
