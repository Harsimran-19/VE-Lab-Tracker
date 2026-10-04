import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { JWT } from "google-auth-library";
import { appendSheet, initializeSheet, readSheet, replaceSheet, SheetSetupError, TABLES } from "../lib/sheets";
import { AppError } from "../lib/access";
import type { Store, Update } from "../lib/types";
import seed from "../lib/seed.json";

const originalFetch=globalThis.fetch;
const originalToken=JWT.prototype.getAccessToken;
const originalEnv={GOOGLE_SHEET_ID:process.env.GOOGLE_SHEET_ID,GOOGLE_SERVICE_ACCOUNT_EMAIL:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,GOOGLE_PRIVATE_KEY:process.env.GOOGLE_PRIVATE_KEY};
before(()=>{
  process.env.GOOGLE_SHEET_ID="unit-test-sheet";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL="unit-test@example.invalid";
  process.env.GOOGLE_PRIVATE_KEY="unit-test-placeholder-never-signed";
  JWT.prototype.getAccessToken=async()=>({token:"unit-test-token"});
});
after(()=>{
  globalThis.fetch=originalFetch;JWT.prototype.getAccessToken=originalToken;
  for(const [key,value] of Object.entries(originalEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
function response(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});}
function metadata(){return {sheets:Object.keys(TABLES).map((title,sheetId)=>({properties:{title,sheetId}}))};}
function valueRanges(){const keys={Projects:"projects",People:"people",Assignments:"assignments",Collaborators:"collaborators",Updates:"updates"} as const;return {valueRanges:(Object.keys(TABLES) as (keyof typeof TABLES)[]).map(table=>({values:[[...TABLES[table]],...seed[keys[table]].map(row=>TABLES[table].map(key=>String((row as unknown as Record<string,string>)[key]??"")))]}))};}

test("reads the normalized workbook and rejects renamed headers",async()=>{
  globalThis.fetch=async(input)=>response(String(input).includes("values:batchGet")?valueRanges():metadata());
  const store=await readSheet();assert.equal(store.projects.length,15);assert.equal(store.assignments.length,21);assert.equal(store.updates.length,0);
  const wrong=valueRanges();wrong.valueRanges[0].values[0][0]="renamed";
  globalThis.fetch=async(input)=>response(String(input).includes("values:batchGet")?wrong:metadata());
  await assert.rejects(readSheet(),(e:unknown)=>e instanceof AppError && e.status===409);
});
test("a newly created or wholly empty spreadsheet can be initialized",async()=>{
  globalThis.fetch=async()=>response({sheets:[{properties:{title:"Sheet1"}}]});
  await assert.rejects(readSheet(),SheetSetupError);
  globalThis.fetch=async(input)=>response(String(input).includes("values:batchGet")?{valueRanges:Object.keys(TABLES).map(()=>({}))}:metadata());
  await assert.rejects(readSheet(),SheetSetupError);
});
test("initialization never overwrites a populated existing project tab",async()=>{
  const writes:string[]=[];
  globalThis.fetch=async(input,init)=>{
    if(init?.method)writes.push(init.method);
    return response(String(input).includes("/values/")?{values:[["id","name"],["existing","Original research"]]}:metadata());
  };
  await assert.rejects(initializeSheet(seed as Store),(e:unknown)=>e instanceof AppError&&e.status===409);
  assert.deepEqual(writes,[]);
});
test("initialization creates five tabs, seeds data with RAW writes, and starts with no reports",async()=>{
  const calls:{url:string;body:Record<string,unknown>}[]=[];
  let created=false;
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if(init?.body){calls.push({url,body:JSON.parse(String(init.body))});if(url.endsWith(":batchUpdate")&&!url.includes("/values"))created=true;return response({});}
    if(url.includes("values:batchGet"))return response(valueRanges());
    return response(created?metadata():{sheets:[{properties:{title:"Sheet1",sheetId:0}}]});
  };
  const store=await initializeSheet(seed as Store);assert.equal(store.projects.length,15);
  assert.equal((calls[0].body.requests as unknown[]).length,5);
  assert.equal(calls[1].body.valueInputOption,"RAW");
  const ranges=calls[1].body.data as {range:string;values:string[][]}[];
  assert.equal(ranges.find(r=>r.range==="'Updates'!A1")!.values.length,1);
});
test("report append preserves text as RAW values and requests row insertion",async()=>{
  const update:Update={id:"test-report",createdAt:"2026-10-04T12:00:00Z",projectId:"P10",assignmentId:"A016",personId:"hars",progress:"=IMPORTXML(\"example\")",blockers:"",nextPlan:"",status:"On track"};
  let requestUrl="";let requestBody:{values:string[][]}|undefined;
  globalThis.fetch=async(input,init)=>{requestUrl=String(input);requestBody=JSON.parse(String(init?.body));return response({});};
  await appendSheet("Updates",update);
  assert.ok(requestUrl.includes("valueInputOption=RAW"));assert.ok(requestUrl.includes("insertDataOption=INSERT_ROWS"));
  assert.equal(requestBody!.values[0][5],update.progress);
});
test("admin edits resolve the current row by ID instead of using client row numbers",async()=>{
  let writeUrl="";
  globalThis.fetch=async(input,init)=>{if(init?.method){writeUrl=String(input);return response({});}return response({values:[["id"],["P99"],["P01"]]});};
  await replaceSheet("Projects",seed.projects[0]);
  assert.ok(decodeURIComponent(writeUrl).includes("'Projects'!A3:Z3"));assert.ok(writeUrl.includes("valueInputOption=RAW"));
});
test("Google permission errors return actionable messages without upstream credential details",async()=>{
  globalThis.fetch=async()=>response({error:"upstream-private-details"},403);
  await assert.rejects(readSheet(),(e:unknown)=>e instanceof AppError&&e.status===503&&e.message.includes("share the Sheet")&&!e.message.includes("upstream-private-details"));
});
test("a new member is appended to People with a stable ID, normalized email, and role",async()=>{
  const person={id:"new-person-id",name:"New Member",email:"new@example.com",affiliation:"Lab",role:"member" as const};
  let requestUrl="";let values:string[][]=[];
  globalThis.fetch=async(input,init)=>{requestUrl=String(input);values=JSON.parse(String(init?.body)).values;return response({});};
  await appendSheet("People",person);
  assert.ok(decodeURIComponent(requestUrl).includes("'People'"));
  assert.ok(requestUrl.includes("valueInputOption=RAW"));
  assert.deepEqual(values,[TABLES.People.map(key=>person[key])]);
});
