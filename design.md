bplist00�XUTI-Data�[public.htmlO��<meta charset='utf-8'><html><head></head><body><h1>VE Lab Tracker — design.md</h1>
<p>This is the design spec for <strong>VE Lab Tracker</strong> (<code>Harsimran-19/VE-Lab-Tracker</code>), a Next.js app where a small research lab tracks projects, assignments and weekly progress reports. It replaces the current styling in <code>app/globals.css</code> and the Lucide icons.</p>
<p><strong>For the agent:</strong> follow this file as the single source of truth. The rules in section 1 are hard requirements. Sections 2–6 are the system itself; sections 4 and 5 hold CSS you can paste in verbatim. Section 7 is the step-by-step migration, and section 8 is the checklist to verify against before you finish. If something isn't covered here, choose the plainest option that obeys section 1, and say what you chose.</p>
<hr>
<h2>1. Hard rules (never break these)</h2>
<p><strong>Colour</strong></p>
<ol>
<li>Only four brand colours exist: soft blue <code>#97C2EC</code>, sand <code>#D6D0C2</code>, black <code>#1F1F1F</code>, white <code>#FFFFFF</code>. Everything else is a zinc grey from section 4, plus one red (<code>danger</code>) that is used only for errors and destructive actions.</li>
<li>Blue and sand are <strong>fills only</strong>. Never use them for text, borders, icons or outlines.</li>
<li>Text on a blue or sand fill is always black.</li>
<li>Never hard-code hex values in components. Use the CSS variables from section 4, so dark mode keeps working.</li>
</ol>
<p><strong>Icons</strong>
5. Icons sit <strong>only on neutral backgrounds</strong>: white, the zinc greys, or black. Never put an icon inside a blue or sand fill: no icons in blue/sand badges, the selected choice, info/sand notices or the blue button.
6. <strong>No tinted icon tiles.</strong> Never put an icon in a light coloured box with a darker icon of the same hue (for example, a light-blue square with a blue icon). An icon tile is zinc with a black icon, or black with a white one.
7. Icons are never coloured blue or sand. They take the colour of the text next to them.</p>
<p><strong>Borders</strong>
8. <strong>Filled elements never get a border</strong>, whether the fill is dark or light: badges, chips, avatars, notices, filled buttons, the selected choice, the black stat card.
9. Borders appear in only two places:</p>
<ul>
<li>a 1px <code>line</code> where a white card or panel sits on the grey page, plus dividers inside a white panel;</li>
<li><code>control-border</code> on unfilled controls: inputs, selects, secondary/danger buttons, unselected choices.</li>
</ul>
<ol start="10">
<li>When an element switches from unfilled to filled (for example, a choice gets selected), its border disappears.</li>
<li>No coloured side stripes, no double borders, and never a border and a shadow together. Only modals and the mobile drawer cast a shadow.</li>
</ol>
<p><strong>Content and layout</strong>
12. Keep text minimal and the UI clean and simple, but not empty. Every screen should still feel useful.
13. There is no logo. Never draw, generate or invent one. Use the <code>Flask</code> icon in a zinc tile next to the words "VE Lab".
14. Design for the task (UX), not only for visual match. Each screen should make it obvious what stage projects are in, who is blocked, and what changed this week.
15. The sign-in page is mostly visual: the sign-in form on one side and a rich visual panel on the other, built from the palette and real product content (for example, a live-looking stage meter or report card), with a real title. No stock illustrations or fake logos.
16. Status is never shown by colour alone. Every badge has its word.</p>
<hr>
<h2>2. Product vocabulary — use these exact values</h2>
<table>
<thead>
<tr>
<th>Concept</th>
<th>Values, in order</th>
<th>Shown with</th>
</tr>
</thead>
<tbody>
<tr>
<td>Research stage (<code>STAGES</code>)</td>
<td>Idea · Literature review · Data collection · Data analysis · Findings · Writing · Submission</td>
<td>Stage meter</td>
</tr>
<tr>
<td>Publication pipeline (<code>PIPELINES</code>)</td>
<td>Not submitted · In preparation · Under review · R&amp;R · Rejected – repositioning · Resubmitted · Accepted</td>
<td>Badge</td>
</tr>
<tr>
<td>Priority (<code>PRIORITIES</code>)</td>
<td>P1 Push · P2 Steady · P3 Background</td>
<td>Priority chip</td>
</tr>
<tr>
<td>Report status (<code>STATUSES</code>)</td>
<td>On track · Blocked · Done</td>
<td>Badge</td>
</tr>
<tr>
<td>Role</td>
<td>Admin · Member</td>
<td>Neutral badge</td>
</tr>
</tbody>
</table>
<p><strong>Badge tone mapping</strong></p>
<table>
<thead>
<tr>
<th>Value</th>
<th>Class</th>
<th>Icon allowed?</th>
</tr>
</thead>
<tbody>
<tr>
<td>Not submitted, In preparation, Admin, Member, meta like "Due 14 Nov"</td>
<td><code>ve-badge</code> (zinc)</td>
<td>yes, 16px</td>
</tr>
<tr>
<td>Under review, Resubmitted, On track</td>
<td><code>ve-badge ve-badge--accent</code> (blue)</td>
<td><strong>no</strong></td>
</tr>
<tr>
<td>R&amp;R, Rejected – repositioning, Done</td>
<td><code>ve-badge ve-badge--warm</code> (sand)</td>
<td><strong>no</strong></td>
</tr>
<tr>
<td>Accepted</td>
<td><code>ve-badge ve-badge--primary</code> (black) + <code>CheckCircle</code></td>
<td>yes</td>
</tr>
<tr>
<td>Blocked</td>
<td><code>ve-badge ve-badge--primary</code> (black) + <code>Warning</code></td>
<td>yes</td>
</tr>
</tbody>
</table>
<p><strong>Priority:</strong> P1 = black chip, P2 = sand chip, P3 = zinc chip with grey text. The data stores "P1 - push"; show it as code + capitalised word ("P1 Push").</p>
<p><strong>Stage meter:</strong> seven segments. Completed stages are blue, the current stage is black, stages still to come are zinc. Always show the stage name and "n/7" as well.</p>
<hr>
<h2>3. Voice and copy</h2>
<ul>
<li>Plain and warm, written for researchers. Address the reader as "you" and the lab as "the lab". Short sentences.</li>
<li>Sentence case everywhere. Uppercase only in eyebrow labels and table headers (<code>overline</code>).</li>
<li>Button labels start with a verb: Submit update, Save project, Assign work, Add member, Preview as member, Return to admin, Write an update.</li>
<li>Errors and empty states say what happened and what to do next. No blame, no exclamation marks, no emoji.</li>
<li>Dates: "4 Oct" in lists, "4 Oct 2026" in details. Project IDs: <code>P01</code>. An empty value is an em dash (—).</li>
<li>Copy to keep: "More research. Less reporting." · "Share progress in a few minutes." · "Know what needs your attention." · "This account is not on the lab's member list. Ask the administrator to add your Google email."</li>
</ul>
<hr>
<h2>4. Tokens</h2>
<h3>Colour</h3>
<table>
<thead>
<tr>
<th>Token</th>
<th>Light</th>
<th>Dark</th>
<th>Use</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>blue</code></td>
<td><code>#97c2ec</code></td>
<td><code>#97c2ec</code></td>
<td>Palette · Soft blue (Нежный голубой). The one accent: selection, on-track, under review, progress. A fill only; never text, never a border.</td>
</tr>
<tr>
<td><code>sand</code></td>
<td><code>#d6d0c2</code></td>
<td><code>#d6d0c2</code></td>
<td>Palette · Sand (Светлый коричневый). Warm secondary fill: R&amp;R, Done, P2, avatars. A fill only; never text, never a border.</td>
</tr>
<tr>
<td><code>black</code></td>
<td><code>#1f1f1f</code></td>
<td><code>#1f1f1f</code></td>
<td>Palette · Main black (Основной черный). Text, primary buttons, Blocked, Accepted, P1.</td>
</tr>
<tr>
<td><code>white</code></td>
<td><code>#ffffff</code></td>
<td><code>#ffffff</code></td>
<td>Palette · Main white (Основной белый). Surfaces and text on black.</td>
</tr>
<tr>
<td><code>paper</code></td>
<td><code>#f4f4f5</code></td>
<td><code>#141414</code></td>
<td>Neutral page ground behind panels.</td>
</tr>
<tr>
<td><code>surface</code></td>
<td><code>{white}</code></td>
<td><code>{black}</code></td>
<td>Panels, cards, inputs, modals.</td>
</tr>
<tr>
<td><code>surface-sunken</code></td>
<td><code>#eeeef0</code></td>
<td><code>#191919</code></td>
<td>Table headers, panel footers, neutral notices, icon tiles.</td>
</tr>
<tr>
<td><code>surface-hover</code></td>
<td><code>#e8e8eb</code></td>
<td><code>#2a2a2b</code></td>
<td>Hover fill on neutral rows and buttons; active nav item.</td>
</tr>
<tr>
<td><code>line</code></td>
<td><code>#e4e4e7</code></td>
<td><code>#2e2e30</code></td>
<td>Hairline between a white surface and the zinc ground, and dividers inside white panels. Never on a coloured fill.</td>
</tr>
<tr>
<td><code>control-border</code></td>
<td><code>#84848a</code></td>
<td><code>#6b6b71</code></td>
<td>Edge of inputs, secondary buttons and unselected choices on white (3:1).</td>
</tr>
<tr>
<td><code>ink</code></td>
<td><code>{black}</code></td>
<td><code>{white}</code></td>
<td>Primary text on paper, surface, surface-sunken, blue and sand.</td>
</tr>
<tr>
<td><code>ink-2</code></td>
<td><code>#4a4a4e</code></td>
<td><code>#c4c4c8</code></td>
<td>Secondary text on paper, surface and surface-sunken.</td>
</tr>
<tr>
<td><code>ink-3</code></td>
<td><code>#6b6b71</code></td>
<td><code>#9b9ba1</code></td>
<td>Meta text: dates, IDs, helper text, placeholders, on neutral grounds.</td>
</tr>
<tr>
<td><code>primary</code></td>
<td><code>{black}</code></td>
<td><code>{white}</code></td>
<td>Primary buttons, Blocked and Accepted badges, P1, current stage segment.</td>
</tr>
<tr>
<td><code>on-primary</code></td>
<td><code>{white}</code></td>
<td><code>{black}</code></td>
<td>Text and icons on primary.</td>
</tr>
<tr>
<td><code>primary-hover</code></td>
<td><code>#3a3a3c</code></td>
<td><code>#e4e4e7</code></td>
<td>Hover on primary fills.</td>
</tr>
<tr>
<td><code>accent</code></td>
<td><code>{blue}</code></td>
<td><code>{blue}</code></td>
<td>Selected choice, on-track, under review, info notices, completed stage segments.</td>
</tr>
<tr>
<td><code>on-accent</code></td>
<td><code>{black}</code></td>
<td><code>{black}</code></td>
<td>Text on accent fills. Never an icon.</td>
</tr>
<tr>
<td><code>accent-soft</code></td>
<td><code>#e6f0fb</code></td>
<td><code>#2b3a49</code></td>
<td>Quiet blue fill for info notices. Text on it is ink; no icons, no border.</td>
</tr>
<tr>
<td><code>warm</code></td>
<td><code>{sand}</code></td>
<td><code>{sand}</code></td>
<td>R&amp;R, Done, P2, avatars.</td>
</tr>
<tr>
<td><code>on-warm</code></td>
<td><code>{black}</code></td>
<td><code>{black}</code></td>
<td>Text on warm fills.</td>
</tr>
<tr>
<td><code>warm-soft</code></td>
<td><code>#f1eee8</code></td>
<td><code>#38352f</code></td>
<td>Quiet sand fill for the previous-plan quote and blocker text. Text on it is ink; no icons, no border.</td>
</tr>
<tr>
<td><code>danger</code></td>
<td><code>#b42318</code></td>
<td><code>#f97066</code></td>
<td>Outside the palette: form errors and destructive actions only. Text and icons on neutral grounds.</td>
</tr>
<tr>
<td><code>focus</code></td>
<td><code>{primary}</code></td>
<td><code>{primary}</code></td>
<td>Focus ring: 2px solid, 2px offset.</td>
</tr>
<tr>
<td><code>scrim</code></td>
<td><code>rgba(20, 20, 20, 0.5)</code></td>
<td><code>rgba(0, 0, 0, 0.66)</code></td>
<td>Backdrop behind modals.</td>
</tr>
</tbody>
</table>
<p><strong>Which neutral goes where:</strong> page background <code>paper</code> → cards, panels, inputs and modals <code>surface</code> → table headers, panel footers, neutral notices and icon tiles <code>surface-sunken</code> → hover and active nav item <code>surface-hover</code>. Text is <code>ink</code> (main), <code>ink-2</code> (secondary) or <code>ink-3</code> (meta). All text pairs pass WCAG AA (4.5:1) in both themes. Controls reach 3:1.</p>
<h3>Type</h3>
<p>Fonts come from Google Fonts. Load them once in <code>app/layout.tsx</code> with <code>next/font/google</code>: Source Serif 4 (500), IBM Plex Sans (400, 500, 600), IBM Plex Mono (500, 600). Map them to <code>--font-serif</code>, <code>--font-sans</code> and <code>--font-mono</code>.</p>
<table>
<thead>
<tr>
<th>Style</th>
<th>Family</th>
<th>Size/line</th>
<th>Weight</th>
<th>Tracking</th>
<th>Use</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>display</code></td>
<td>serif</td>
<td>44px/48px</td>
<td>500</td>
<td>-0.02em</td>
<td>Sign-in hero and empty-workspace setup only. One per screen.</td>
</tr>
<tr>
<td><code>title-1</code></td>
<td>serif</td>
<td>32px/38px</td>
<td>500</td>
<td>-0.015em</td>
<td>Page title (h1) at the top of every view.</td>
</tr>
<tr>
<td><code>title-2</code></td>
<td>serif</td>
<td>24px/30px</td>
<td>500</td>
<td>-0.01em</td>
<td>Project title in the detail modal; report form heading; empty-state heading.</td>
</tr>
<tr>
<td><code>heading</code></td>
<td>sans</td>
<td>18px/24px</td>
<td>600</td>
<td>0</td>
<td>Panel and section headings (h2).</td>
</tr>
<tr>
<td><code>subheading</code></td>
<td>sans</td>
<td>15px/22px</td>
<td>600</td>
<td>0</td>
<td>Card titles, person names, modal titles (h3).</td>
</tr>
<tr>
<td><code>body</code></td>
<td>sans</td>
<td>15px/24px</td>
<td>400</td>
<td>0</td>
<td>Default reading text, report progress, descriptions.</td>
</tr>
<tr>
<td><code>body-sm</code></td>
<td>sans</td>
<td>13px/20px</td>
<td>400</td>
<td>0</td>
<td>Table cells, card meta, helper text, notices.</td>
</tr>
<tr>
<td><code>label</code></td>
<td>sans</td>
<td>13px/16px</td>
<td>500</td>
<td>0</td>
<td>Form labels, button text, nav items, badges.</td>
</tr>
<tr>
<td><code>overline</code></td>
<td>sans</td>
<td>11px/16px</td>
<td>600</td>
<td>0.08em</td>
<td>Uppercase eyebrow above titles and table column headers. Always ink-3.</td>
</tr>
<tr>
<td><code>metric</code></td>
<td>sans</td>
<td>32px/36px</td>
<td>500</td>
<td>-0.02em</td>
<td>Stat-card numbers. Set font-variant-numeric: tabular-nums.</td>
</tr>
<tr>
<td><code>mono</code></td>
<td>mono</td>
<td>12px/16px</td>
<td>500</td>
<td>0</td>
<td>Project IDs, priority codes, dates and counts in tables.</td>
</tr>
</tbody>
</table>
<ul>
<li>The serif is only for <code>display</code>, <code>title-1</code>, <code>title-2</code> and empty-state headings. Never use it for body text, labels or numbers.</li>
<li>Page header: <code>overline</code> eyebrow → <code>title-1</code> → one <code>body</code> line in <code>ink-2</code>.</li>
<li>Nothing is smaller than 12px.</li>
</ul>
<h3>Spacing, radius, shadow</h3>
<p>Spacing uses a 4px grid: <code>space-1</code> 4px · <code>space-2</code> 8px · <code>space-3</code> 12px · <code>space-4</code> 16px · <code>space-5</code> 20px · <code>space-6</code> 24px · <code>space-8</code> 32px · <code>space-10</code> 40px · <code>space-16</code> 64px. Card padding is <code>space-5</code>, gaps in card grids <code>space-4</code>, gaps between form fields <code>space-6</code>, gaps between page sections <code>space-8</code>.</p>
<table>
<thead>
<tr>
<th>Radius</th>
<th>Value</th>
<th>Use</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>radius-xs</code></td>
<td>3px</td>
<td>Stage-meter segments.</td>
</tr>
<tr>
<td><code>radius-sm</code></td>
<td>5px</td>
<td>Badges, priority tags, small icon buttons.</td>
</tr>
<tr>
<td><code>radius-md</code></td>
<td>8px</td>
<td>Buttons, inputs, choice tiles, notices.</td>
</tr>
<tr>
<td><code>radius-lg</code></td>
<td>12px</td>
<td>Panels, cards, modals.</td>
</tr>
<tr>
<td><code>radius-full</code></td>
<td>999px</td>
<td>Avatars, dots and the selected-choice marker only.</td>
</tr>
</tbody>
</table>
<p>Shadow: <code>shadow-overlay</code> for modals and the mobile drawer only. Nothing else casts a shadow.</p>
<p>Focus: every interactive element shows a 2px <code>focus</code> outline with a 2px offset (black in light mode, white in dark mode). Never remove it.</p>
<p>Motion: colour transitions of 120ms only. Respect <code>prefers-reduced-motion</code>.</p>
<h3>tokens.css (paste verbatim)</h3>
<pre><code class="language-css">:root,
[data-theme="light"] {
  --blue: #97c2ec;
  --sand: #d6d0c2;
  --black: #1f1f1f;
  --white: #ffffff;
  --paper: #f4f4f5;
  --surface: var(--white);
  --surface-sunken: #eeeef0;
  --surface-hover: #e8e8eb;
  --line: #e4e4e7;
  --control-border: #84848a;
  --ink: var(--black);
  --ink-2: #4a4a4e;
  --ink-3: #6b6b71;
  --primary: var(--black);
  --on-primary: var(--white);
  --primary-hover: #3a3a3c;
  --accent: var(--blue);
  --on-accent: var(--black);
  --accent-soft: #e6f0fb;
  --warm: var(--sand);
  --on-warm: var(--black);
  --warm-soft: #f1eee8;
  --danger: #b42318;
  --focus: var(--primary);
  --scrim: rgba(20, 20, 20, 0.5);
  --shadow-overlay: 0 24px 64px rgba(31, 31, 31, 0.18);
}

[data-theme="dark"] {
  --paper: #141414;
  --surface: var(--black);
  --surface-sunken: #191919;
  --surface-hover: #2a2a2b;
  --line: #2e2e30;
  --control-border: #6b6b71;
  --ink: var(--white);
  --ink-2: #c4c4c8;
  --ink-3: #9b9ba1;
  --primary: var(--white);
  --on-primary: var(--black);
  --primary-hover: #e4e4e7;
  --accent-soft: #2b3a49;
  --warm-soft: #38352f;
  --danger: #f97066;
  --scrim: rgba(0, 0, 0, 0.66);
  --shadow-overlay: 0 24px 64px rgba(0, 0, 0, 0.6);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #141414;
    --surface: var(--black);
    --surface-sunken: #191919;
    --surface-hover: #2a2a2b;
    --line: #2e2e30;
    --control-border: #6b6b71;
    --ink: var(--white);
    --ink-2: #c4c4c8;
    --ink-3: #9b9ba1;
    --primary: var(--white);
    --on-primary: var(--black);
    --primary-hover: #e4e4e7;
    --accent-soft: #2b3a49;
    --warm-soft: #38352f;
    --danger: #f97066;
    --scrim: rgba(0, 0, 0, 0.66);
    --shadow-overlay: 0 24px 64px rgba(0, 0, 0, 0.6);
  }
}

:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-16: 64px;
  --radius-xs: 3px;
  --radius-sm: 5px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 999px;
  --font-serif: "Source Serif 4", "Source Serif Pro", Georgia, serif;
  --font-sans: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
</code></pre>
<hr>
<h2>5. Components</h2>
<p>All components are plain CSS classes with the prefix <code>ve-</code>. Load <code>tokens.css</code>, then <code>components.css</code>, and put <code>className="ve-root"</code> on the app's outermost element. In React, apply the classes to your own elements as shown.</p>
<h3>Markup reference</h3>
<p><strong>Button</strong>: one <code>--primary</code> per view or modal. <code>--accent</code> (blue) is for one friendly highlighted action per screen and never has an icon.</p>
<pre><code class="language-html">&lt;button class="ve-btn ve-btn--primary"&gt;&lt;PaperPlaneTilt/&gt;Submit update&lt;/button&gt;
&lt;button class="ve-btn ve-btn--accent"&gt;Write an update&lt;/button&gt;
&lt;button class="ve-btn ve-btn--secondary"&gt;&lt;UserPlus/&gt;Add member&lt;/button&gt;
&lt;button class="ve-btn ve-btn--ghost"&gt;View all reports&lt;ArrowRight/&gt;&lt;/button&gt;
&lt;button class="ve-btn ve-btn--danger"&gt;Remove assignment&lt;/button&gt;
&lt;button class="ve-icon-btn" aria-label="Close dialog"&gt;&lt;X/&gt;&lt;/button&gt;
</code></pre>
<p>Modifiers: <code>ve-btn--sm</code> (32px), <code>ve-btn--block</code>. While saving, disable the button and change its label to "Saving…".</p>
<p><strong>Field</strong></p>
<pre><code class="language-html">&lt;label class="ve-field"&gt;&lt;span class="ve-label"&gt;Name&lt;/span&gt;&lt;input class="ve-input"&gt;&lt;/label&gt;
&lt;label class="ve-field"&gt;&lt;span class="ve-label"&gt;Blockers &lt;span class="ve-optional"&gt;Optional&lt;/span&gt;&lt;/span&gt;&lt;textarea class="ve-textarea"&gt;&lt;/textarea&gt;&lt;/label&gt;
&lt;label class="ve-field ve-field--error"&gt;&lt;span class="ve-label"&gt;Due date&lt;/span&gt;&lt;input class="ve-input"&gt;&lt;span class="ve-help"&gt;&lt;WarningCircle size={16}/&gt;Enter a real date, like 14 Nov 2026.&lt;/span&gt;&lt;/label&gt;
</code></pre>
<p>Labels are always visible. Placeholders are examples, not labels. Use 16px input text on phones.</p>
<p><strong>Search / filter bar</strong></p>
<pre><code class="language-html">&lt;label class="ve-search"&gt;&lt;span class="ve-sr"&gt;Search projects&lt;/span&gt;&lt;MagnifyingGlass/&gt;&lt;input class="ve-input" placeholder="Search projects, journals or people"&gt;&lt;/label&gt;
&lt;select class="ve-select" aria-label="Stage"&gt;…&lt;/select&gt;
</code></pre>
<p><strong>Choice</strong> (report status)</p>
<pre><code class="language-html">&lt;fieldset class="ve-choice"&gt;&lt;legend&gt;How is this responsibility going?&lt;/legend&gt;
  &lt;label class="ve-choice__opt"&gt;&lt;input type="radio" name="status" checked&gt;On track&lt;/label&gt;
  &lt;label class="ve-choice__opt"&gt;&lt;input type="radio" name="status"&gt;Blocked&lt;/label&gt;
  &lt;label class="ve-choice__opt"&gt;&lt;input type="radio" name="status"&gt;Done&lt;/label&gt;
&lt;/fieldset&gt;
</code></pre>
<p><strong>Stage meter</strong></p>
<pre><code class="language-html">&lt;div class="ve-stage" data-stage="4" role="img" aria-label="Stage 4 of 7: Data analysis"&gt;
  &lt;div class="ve-stage__label"&gt;Data analysis&lt;span&gt;4/7&lt;/span&gt;&lt;/div&gt;
  &lt;div class="ve-stage__track"&gt;&lt;i&gt;&lt;/i&gt;&lt;i&gt;&lt;/i&gt;&lt;i&gt;&lt;/i&gt;&lt;i&gt;&lt;/i&gt;&lt;i&gt;&lt;/i&gt;&lt;i&gt;&lt;/i&gt;&lt;i&gt;&lt;/i&gt;&lt;/div&gt;
&lt;/div&gt;
</code></pre>
<p><code>data-stage</code> = <code>STAGES.indexOf(stage) + 1</code>.</p>
<p><strong>Badge / Priority / Avatar</strong></p>
<pre><code class="language-html">&lt;span class="ve-badge ve-badge--accent"&gt;Under review&lt;/span&gt;
&lt;span class="ve-badge ve-badge--primary"&gt;&lt;Warning size={16}/&gt;Blocked&lt;/span&gt;
&lt;span class="ve-priority ve-priority--p1"&gt;&lt;b&gt;P1&lt;/b&gt;Push&lt;/span&gt;
&lt;span class="ve-avatar"&gt;HS&lt;/span&gt;  &lt;!-- --sm 28px, default 36px, --lg 48px --&gt;
&lt;span class="ve-avatar-stack"&gt;&lt;span class="ve-avatar ve-avatar--sm"&gt;HS&lt;/span&gt;&lt;span class="ve-avatar ve-avatar--sm ve-more"&gt;+2&lt;/span&gt;&lt;/span&gt;
</code></pre>
<p>Avatars show two initials on sand. After three avatars in a stack, show "+N".</p>
<p><strong>Icon tile</strong> (neutral only)</p>
<pre><code class="language-html">&lt;span class="ve-icon-tile"&gt;&lt;Flask/&gt;&lt;/span&gt;   &lt;!-- 40px zinc; ve-icon-tile--lg = 56px --&gt;
</code></pre>
<p><strong>Panel</strong></p>
<pre><code class="language-html">&lt;section class="ve-panel"&gt;
  &lt;header class="ve-panel__head"&gt;&lt;div&gt;&lt;h2&gt;Needs attention&lt;/h2&gt;&lt;p&gt;Blockers reported in the last 14 days.&lt;/p&gt;&lt;/div&gt;&lt;span class="ve-badge ve-badge--primary"&gt;2 blocked&lt;/span&gt;&lt;/header&gt;
  &lt;div class="ve-panel__body"&gt;…&lt;/div&gt;
  &lt;footer class="ve-panel__foot"&gt;Reports sync from the Updates sheet.&lt;/footer&gt;
&lt;/section&gt;
</code></pre>
<p>Panels never sit inside other panels.</p>
<p><strong>Stat card</strong>: four across. Use <code>--attention</code> (black) only for the Blocked count, and only when it is above zero.</p>
<pre><code class="language-html">&lt;div class="ve-stat"&gt;&lt;div class="ve-stat__label"&gt;Active projects&lt;Kanban/&gt;&lt;/div&gt;&lt;div class="ve-stat__value"&gt;15&lt;/div&gt;&lt;div class="ve-stat__note"&gt;6 in submission&lt;/div&gt;&lt;/div&gt;
&lt;div class="ve-stat ve-stat--attention"&gt;&lt;div class="ve-stat__label"&gt;Blocked&lt;Warning/&gt;&lt;/div&gt;&lt;div class="ve-stat__value"&gt;2&lt;/div&gt;&lt;div class="ve-stat__note"&gt;Need a decision&lt;/div&gt;&lt;/div&gt;
</code></pre>
<p><strong>Projects table</strong>: columns in this order: Project · Stage · Pipeline · Priority · Team · Last update. The project name is a button that opens the detail modal. The table scrolls sideways on small screens.</p>
<pre><code class="language-html">&lt;div class="ve-panel"&gt;&lt;div class="ve-table-wrap"&gt;&lt;table class="ve-table"&gt;
  &lt;thead&gt;&lt;tr&gt;&lt;th&gt;Project&lt;/th&gt;&lt;th&gt;Stage&lt;/th&gt;&lt;th&gt;Pipeline&lt;/th&gt;&lt;th&gt;Priority&lt;/th&gt;&lt;th&gt;Team&lt;/th&gt;&lt;th&gt;Last update&lt;/th&gt;&lt;/tr&gt;&lt;/thead&gt;
  &lt;tbody&gt;&lt;tr&gt;&lt;td class="ve-table__project"&gt;&lt;strong&gt;Templates Backfire&lt;/strong&gt;&lt;span&gt;P01 · SEJ&lt;/span&gt;&lt;/td&gt;&lt;td&gt;{stage meter}&lt;/td&gt;&lt;td&gt;{badge}&lt;/td&gt;&lt;td&gt;{priority}&lt;/td&gt;&lt;td&gt;{avatar stack}&lt;/td&gt;&lt;td class="ve-mono"&gt;2 Oct&lt;/td&gt;&lt;/tr&gt;&lt;/tbody&gt;
&lt;/table&gt;&lt;/div&gt;&lt;/div&gt;
</code></pre>
<p><strong>Report card</strong> (progress update): show the member's text exactly as written. Leave out the blocker block when there is no blocker.</p>
<pre><code class="language-html">&lt;article class="ve-report"&gt;
  &lt;div class="ve-report__head"&gt;&lt;span class="ve-avatar"&gt;HS&lt;/span&gt;&lt;div&gt;&lt;strong&gt;Harsimran Singh&lt;/strong&gt;&lt;span&gt;Templates Backfire · Coding interviews&lt;/span&gt;&lt;/div&gt;&lt;span class="ve-report__date"&gt;4 Oct&lt;/span&gt;&lt;/div&gt;
  &lt;p class="ve-report__body"&gt;Finished coding the second wave of interviews…&lt;/p&gt;
  &lt;p class="ve-report__blocker"&gt;&lt;b&gt;Blocker:&lt;/b&gt; Six transcripts are still with the transcription service.&lt;/p&gt;
  &lt;p class="ve-report__next"&gt;&lt;b&gt;Next:&lt;/b&gt; Finish the last six and draft the findings table.&lt;/p&gt;
  &lt;div class="ve-report__foot"&gt;&lt;span class="ve-badge ve-badge--primary"&gt;&lt;Warning size={16}/&gt;Blocked&lt;/span&gt;&lt;button class="ve-btn ve-btn--ghost ve-btn--sm"&gt;Open project&lt;ArrowRight/&gt;&lt;/button&gt;&lt;/div&gt;
&lt;/article&gt;
</code></pre>
<p><strong>Person card</strong>: members see the card without <code>ve-person__actions</code>.</p>
<pre><code class="language-html">&lt;article class="ve-person"&gt;
  &lt;div class="ve-person__head"&gt;&lt;span class="ve-avatar ve-avatar--lg"&gt;FN&lt;/span&gt;&lt;div&gt;&lt;h3&gt;Fanny N.&lt;/h3&gt;&lt;p&gt;Doctoral researcher&lt;/p&gt;&lt;/div&gt;&lt;span class="ve-badge"&gt;Member&lt;/span&gt;&lt;/div&gt;
  &lt;div class="ve-person__projects"&gt;&lt;span class="ve-badge"&gt;P01&lt;/span&gt;&lt;span class="ve-badge"&gt;P04&lt;/span&gt;&lt;/div&gt;
  &lt;div class="ve-person__email"&gt;&lt;EnvelopeSimple size={16}/&gt;fanny@example.org&lt;/div&gt;
  &lt;div class="ve-person__actions"&gt;&lt;button class="ve-btn ve-btn--secondary ve-btn--sm"&gt;&lt;PencilSimple/&gt;Edit&lt;/button&gt;&lt;button class="ve-btn ve-btn--ghost ve-btn--sm"&gt;&lt;Eye/&gt;Preview as member&lt;/button&gt;&lt;/div&gt;
&lt;/article&gt;
</code></pre>
<p><strong>Notice</strong></p>
<pre><code class="language-html">&lt;div class="ve-notice"&gt;&lt;CheckCircle/&gt;&lt;p&gt;Update saved. It's now in the Updates sheet.&lt;/p&gt;&lt;/div&gt;                          &lt;!-- zinc, icon ok --&gt;
&lt;div class="ve-notice ve-notice--danger" role="alert"&gt;&lt;WarningCircle/&gt;&lt;div&gt;&lt;strong&gt;Access denied&lt;/strong&gt;&lt;p&gt;…&lt;/p&gt;&lt;/div&gt;&lt;/div&gt;  &lt;!-- zinc, red icon + title --&gt;
&lt;div class="ve-notice ve-notice--info"&gt;&lt;div&gt;&lt;strong&gt;Previewing Fanny's view&lt;/strong&gt;&lt;p&gt;Read-only.&lt;/p&gt;&lt;/div&gt;&lt;button class="ve-btn ve-btn--primary ve-btn--sm ve-notice__action"&gt;Return to admin&lt;/button&gt;&lt;/div&gt;  &lt;!-- soft blue, NO icon --&gt;
&lt;div class="ve-notice ve-notice--warm"&gt;&lt;p&gt;&lt;b&gt;Blocker:&lt;/b&gt; …&lt;/p&gt;&lt;/div&gt;                                                &lt;!-- soft sand, NO icon --&gt;
</code></pre>
<p><strong>Modal</strong>: use the native <code>&lt;dialog&gt;</code> with <code>showModal()</code>. Esc, a backdrop click and the close button all close it, and focus returns to the button that opened it. Never open a modal on top of another modal.</p>
<pre><code class="language-html">&lt;dialog class="ve-modal" aria-labelledby="t"&gt;
  &lt;div class="ve-modal__head"&gt;&lt;h2 id="t"&gt;Add a lab member&lt;/h2&gt;&lt;button class="ve-icon-btn" aria-label="Close dialog"&gt;&lt;X/&gt;&lt;/button&gt;&lt;/div&gt;
  &lt;div class="ve-modal__body"&gt;…fields…&lt;/div&gt;
  &lt;div class="ve-modal__actions"&gt;&lt;button class="ve-btn ve-btn--secondary"&gt;Cancel&lt;/button&gt;&lt;button class="ve-btn ve-btn--primary"&gt;Add member&lt;/button&gt;&lt;/div&gt;
&lt;/dialog&gt;
</code></pre>
<p><strong>Empty state</strong>: at most one button, and only if this person can fix it themselves.</p>
<pre><code class="language-html">&lt;div class="ve-empty"&gt;&lt;span class="ve-icon-tile ve-icon-tile--lg"&gt;&lt;Tray size={24}/&gt;&lt;/span&gt;&lt;h3&gt;No updates yet&lt;/h3&gt;&lt;p&gt;When members share progress on their responsibilities, it shows up here.&lt;/p&gt;&lt;button class="ve-btn ve-btn--primary"&gt;&lt;PaperPlaneTilt/&gt;Write an update&lt;/button&gt;&lt;/div&gt;
</code></pre>
<p><strong>Sidebar nav</strong>: the current page gets a zinc fill, bold text and the icon's <strong>fill</strong> weight. It never gets a blue fill.</p>
<pre><code class="language-html">&lt;nav class="ve-nav"&gt;
  &lt;div class="ve-nav__label"&gt;Workspace&lt;/div&gt;
  &lt;a class="ve-nav__item" aria-current="page"&gt;&lt;SquaresFour weight="fill"/&gt;Overview&lt;/a&gt;
  &lt;a class="ve-nav__item"&gt;&lt;Kanban/&gt;Projects&lt;span class="ve-nav__count"&gt;15&lt;/span&gt;&lt;/a&gt;
&lt;/nav&gt;
</code></pre>
<h3>components.css (paste verbatim)</h3>
<pre><code class="language-css">/* VE Lab Tracker — component styles. Every value comes from tokens.css (var(--…)). Class prefix: ve-
   Two rules are enforced here, not just documented:
   1. Icons sit only on neutral grounds (white, zinc, black). Inside a blue or sand fill, icons are hidden.
   2. Coloured fills (blue, sand, their soft tints, black chips) never get a border. Borders exist only
      where a white surface meets the zinc ground, or on an unfilled control. */

.ve-root, .ve-root * { box-sizing: border-box; }
.ve-root { font-family: var(--font-sans); font-size: 15px; line-height: 24px; color: var(--ink); background: var(--paper); -webkit-font-smoothing: antialiased; }
.ve-root :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* ---------- Icon (Phosphor, fill="currentColor") ---------- */
.ve-icon { width: 20px; height: 20px; flex-shrink: 0; fill: currentColor; }
.ve-icon--16 { width: 16px; height: 16px; }
.ve-icon--24 { width: 24px; height: 24px; }
.ve-icon--32 { width: 32px; height: 32px; }
/* rule 1: no icons inside coloured fills */
.ve-btn--accent .ve-icon, .ve-badge--accent .ve-icon, .ve-badge--warm .ve-icon,
.ve-notice--info .ve-icon, .ve-notice--warm .ve-icon, .ve-choice__opt .ve-icon { display: none; }

/* ---------- Text helpers ---------- */
.ve-overline { font: 600 11px/16px var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); margin: 0; }
.ve-title { font: 500 32px/38px var(--font-serif); letter-spacing: -.015em; margin: 0; color: var(--ink); }
.ve-muted { color: var(--ink-3); }
.ve-mono { font: 500 12px/16px var(--font-mono); color: var(--ink-3); }
.ve-link { color: var(--ink); text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 3px; }
.ve-link:hover { text-decoration-color: var(--ink); }

/* ---------- Button ---------- */
.ve-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 40px; padding: 0 var(--space-4); border: 0; border-radius: var(--radius-md); font: 500 13px/16px var(--font-sans); white-space: nowrap; cursor: pointer; text-decoration: none; transition: background-color .12s; }
.ve-btn .ve-icon { width: 18px; height: 18px; }
.ve-btn--primary { background: var(--primary); color: var(--on-primary); }
.ve-btn--primary:hover { background: var(--primary-hover); }
.ve-btn--accent { background: var(--accent); color: var(--on-accent); }
.ve-btn--accent:hover { filter: brightness(.95); }
.ve-btn--secondary { background: var(--surface); color: var(--ink); box-shadow: inset 0 0 0 1px var(--control-border); }
.ve-btn--secondary:hover { background: var(--surface-hover); }
.ve-btn--ghost { background: transparent; color: var(--ink); padding: 0 var(--space-2); }
.ve-btn--ghost:hover { background: var(--surface-hover); }
.ve-btn--danger { background: var(--surface); color: var(--danger); box-shadow: inset 0 0 0 1px var(--control-border); }
.ve-btn--danger:hover { background: var(--surface-hover); }
.ve-btn--sm { min-height: 32px; padding: 0 var(--space-3); }
.ve-btn--block { width: 100%; }
.ve-btn:disabled, .ve-btn[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
.ve-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: var(--radius-md); background: transparent; color: var(--ink-2); cursor: pointer; }
.ve-icon-btn:hover { background: var(--surface-hover); color: var(--ink); }

/* ---------- Field ---------- */
.ve-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ve-label { font: 500 13px/16px var(--font-sans); color: var(--ink); }
.ve-label .ve-optional { font-weight: 400; color: var(--ink-3); margin-left: var(--space-1); }
.ve-input, .ve-select, .ve-textarea { width: 100%; min-height: 40px; padding: 9px var(--space-3); border: 1px solid var(--control-border); border-radius: var(--radius-md); background: var(--surface); color: var(--ink); font: 400 15px/20px var(--font-sans); }
.ve-input::placeholder, .ve-textarea::placeholder { color: var(--ink-3); }
.ve-select { appearance: none; padding-right: 36px; background-image: linear-gradient(45deg, transparent 50%, var(--ink-2) 50%), linear-gradient(135deg, var(--ink-2) 50%, transparent 50%); background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
.ve-textarea { min-height: 112px; line-height: 24px; resize: vertical; }
.ve-input:focus, .ve-select:focus, .ve-textarea:focus { outline: 2px solid var(--focus); outline-offset: 0; border-color: var(--focus); }
.ve-help { display: flex; align-items: center; gap: 6px; font: 400 13px/20px var(--font-sans); color: var(--ink-3); }
.ve-field--error .ve-input, .ve-field--error .ve-textarea, .ve-field--error .ve-select { border-color: var(--danger); }
.ve-field--error .ve-help { color: var(--danger); }
.ve-search { position: relative; display: block; }
.ve-search .ve-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--ink-3); pointer-events: none; }
.ve-search .ve-input { padding-left: 40px; }
.ve-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

/* ---------- Choice (status radio tiles) ---------- */
.ve-choice { display: flex; flex-wrap: wrap; gap: var(--space-2); border: 0; margin: 0; padding: 0; }
.ve-choice legend { font: 500 13px/16px var(--font-sans); color: var(--ink); margin-bottom: var(--space-2); padding: 0; }
.ve-choice__opt { position: relative; display: inline-flex; align-items: center; gap: var(--space-2); min-height: 40px; padding: 0 var(--space-4) 0 var(--space-3); border-radius: var(--radius-md); background: var(--surface); box-shadow: inset 0 0 0 1px var(--control-border); font: 500 13px/16px var(--font-sans); color: var(--ink); cursor: pointer; }
.ve-choice__opt input { position: absolute; opacity: 0; pointer-events: none; }
.ve-choice__opt::before { content: ""; width: 8px; height: 8px; border-radius: var(--radius-full); background: var(--control-border); }
.ve-choice__opt:hover { background: var(--surface-hover); }
.ve-choice__opt:has(input:checked) { background: var(--accent); color: var(--on-accent); box-shadow: none; }
.ve-choice__opt:has(input:checked)::before { background: var(--on-accent); }
.ve-choice__opt:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }

/* ---------- Stage meter (7 research stages) ---------- */
.ve-stage { display: inline-flex; flex-direction: column; gap: 6px; min-width: 132px; }
.ve-stage__label { display: flex; justify-content: space-between; gap: var(--space-2); font: 500 13px/16px var(--font-sans); color: var(--ink); }
.ve-stage__label span { font: 500 12px/16px var(--font-mono); color: var(--ink-3); }
.ve-stage__track { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.ve-stage__track i { display: block; height: 6px; border-radius: var(--radius-xs); background: var(--line); }
.ve-stage[data-stage="2"] i:nth-child(-n+1), .ve-stage[data-stage="3"] i:nth-child(-n+2), .ve-stage[data-stage="4"] i:nth-child(-n+3), .ve-stage[data-stage="5"] i:nth-child(-n+4), .ve-stage[data-stage="6"] i:nth-child(-n+5), .ve-stage[data-stage="7"] i:nth-child(-n+6) { background: var(--accent); }
.ve-stage[data-stage="1"] i:nth-child(1), .ve-stage[data-stage="2"] i:nth-child(2), .ve-stage[data-stage="3"] i:nth-child(3), .ve-stage[data-stage="4"] i:nth-child(4), .ve-stage[data-stage="5"] i:nth-child(5), .ve-stage[data-stage="6"] i:nth-child(6), .ve-stage[data-stage="7"] i:nth-child(7) { background: var(--primary); }

/* ---------- Badge ---------- */
.ve-badge { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 var(--space-2); border: 0; border-radius: var(--radius-sm); font: 500 12px/16px var(--font-sans); white-space: nowrap; background: var(--surface-sunken); color: var(--ink-2); }
.ve-badge .ve-icon { width: 14px; height: 14px; }
.ve-badge--accent { background: var(--accent); color: var(--on-accent); }
.ve-badge--warm { background: var(--warm); color: var(--on-warm); }
.ve-badge--primary { background: var(--primary); color: var(--on-primary); }

/* ---------- Priority ---------- */
.ve-priority { display: inline-flex; align-items: center; gap: var(--space-2); font: 400 13px/16px var(--font-sans); color: var(--ink-2); white-space: nowrap; }
.ve-priority b { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 20px; padding: 0 5px; border-radius: var(--radius-sm); font: 600 11px/1 var(--font-mono); }
.ve-priority--p1 b { background: var(--primary); color: var(--on-primary); }
.ve-priority--p2 b { background: var(--warm); color: var(--on-warm); }
.ve-priority--p3 b { background: var(--surface-sunken); color: var(--ink-3); }

/* ---------- Avatar ---------- */
.ve-avatar { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--radius-full); background: var(--warm); color: var(--on-warm); font: 600 13px/1 var(--font-sans); letter-spacing: .02em; }
.ve-avatar--sm { width: 28px; height: 28px; font-size: 11px; }
.ve-avatar--lg { width: 48px; height: 48px; font-size: 16px; }
.ve-avatar-stack { display: inline-flex; }
.ve-avatar-stack .ve-avatar { outline: 2px solid var(--surface); }  /* a cut-out gap between circles, not a border */
.ve-avatar-stack .ve-avatar + .ve-avatar { margin-left: -6px; }
.ve-avatar-stack .ve-more { background: var(--surface-sunken); color: var(--ink-2); }

/* ---------- Icon tile (neutral only) ---------- */
.ve-icon-tile { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: var(--radius-md); background: var(--surface-sunken); color: var(--ink); }
.ve-icon-tile--lg { width: 56px; height: 56px; border-radius: var(--radius-lg); }

/* ---------- Panel ---------- */
.ve-panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden; }
.ve-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); padding: var(--space-5); }
.ve-panel__head h2 { font: 600 18px/24px var(--font-sans); margin: 0; color: var(--ink); }
.ve-panel__head p { font: 400 13px/20px var(--font-sans); color: var(--ink-3); margin: 2px 0 0; }
.ve-panel__body { padding: 0 var(--space-5) var(--space-5); }
.ve-panel__foot { padding: var(--space-3) var(--space-5); background: var(--surface-sunken); font: 400 13px/20px var(--font-sans); color: var(--ink-3); }

/* ---------- Stat card ---------- */
.ve-stat { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); min-width: 0; }
.ve-stat__label { display: flex; align-items: center; justify-content: space-between; font: 500 13px/16px var(--font-sans); color: var(--ink-2); }
.ve-stat__label .ve-icon { color: var(--ink-3); }
.ve-stat__value { font: 500 32px/36px var(--font-sans); letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: var(--ink); }
.ve-stat__note { font: 400 13px/20px var(--font-sans); color: var(--ink-3); }
.ve-stat--attention { background: var(--primary); border-color: transparent; }
.ve-stat--attention .ve-stat__label, .ve-stat--attention .ve-stat__value, .ve-stat--attention .ve-stat__note, .ve-stat--attention .ve-icon { color: var(--on-primary); }

/* ---------- Report card (progress update) ---------- */
.ve-report { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); }
.ve-report__head { display: flex; align-items: center; gap: var(--space-3); }
.ve-report__head &gt; div { flex: 1; min-width: 0; }
.ve-report__head strong { display: block; font: 600 15px/22px var(--font-sans); color: var(--ink); }
.ve-report__head &gt; div &gt; span { font: 400 13px/20px var(--font-sans); color: var(--ink-3); }
.ve-report__date { font: 500 12px/16px var(--font-mono); color: var(--ink-3); flex-shrink: 0; }
.ve-report__body { font: 400 15px/24px var(--font-sans); color: var(--ink); margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ve-report__blocker { margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--warm-soft); color: var(--ink); font: 400 13px/20px var(--font-sans); }
.ve-report__blocker b, .ve-report__next b { font-weight: 600; }
.ve-report__next { font: 400 13px/20px var(--font-sans); color: var(--ink-2); margin: 0; }
.ve-report__next b { color: var(--ink); }
.ve-report__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--line); }

/* ---------- Notice ---------- */
.ve-notice { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-4); border: 0; border-radius: var(--radius-md); font: 400 13px/20px var(--font-sans); background: var(--surface-sunken); color: var(--ink); }
.ve-notice .ve-icon { margin-top: 0; }
.ve-notice strong { display: block; font-weight: 600; }
.ve-notice p { margin: 0; }
.ve-notice--info { background: var(--accent-soft); }
.ve-notice--warm { background: var(--warm-soft); }
.ve-notice--danger .ve-icon, .ve-notice--danger strong { color: var(--danger); }
.ve-notice__action { margin-left: auto; flex-shrink: 0; }

/* ---------- Person card ---------- */
.ve-person { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); min-width: 0; }
.ve-person__head { display: flex; align-items: center; gap: var(--space-3); }
.ve-person__head h3 { font: 600 15px/22px var(--font-sans); margin: 0; color: var(--ink); }
.ve-person__head p { font: 400 13px/20px var(--font-sans); margin: 0; color: var(--ink-3); }
.ve-person__head .ve-badge { margin-left: auto; }
.ve-person__projects { display: flex; flex-wrap: wrap; gap: 6px; }
.ve-person__email { display: flex; align-items: center; gap: var(--space-2); font: 500 12px/16px var(--font-mono); color: var(--ink-2); overflow-wrap: anywhere; padding-top: var(--space-3); border-top: 1px solid var(--line); }
.ve-person__email .ve-icon { color: var(--ink-3); }
.ve-person__actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

/* ---------- Table ---------- */
.ve-table-wrap { width: 100%; overflow-x: auto; }
.ve-table { width: 100%; border-collapse: collapse; text-align: left; font: 400 13px/20px var(--font-sans); color: var(--ink); }
.ve-table th { font: 600 11px/16px var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); background: var(--surface-sunken); padding: 10px var(--space-4); white-space: nowrap; }
.ve-table td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); vertical-align: middle; }
.ve-table tbody tr:hover { background: var(--surface-hover); }
.ve-table tbody tr:last-child td { border-bottom: 0; }
.ve-table__project strong { display: block; font-weight: 600; color: var(--ink); }
.ve-table__project span { font: 500 12px/16px var(--font-mono); color: var(--ink-3); }

/* ---------- Nav (sidebar) ---------- */
.ve-nav { display: flex; flex-direction: column; gap: 2px; }
.ve-nav__label { font: 600 11px/16px var(--font-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); padding: 0 var(--space-3); margin: var(--space-4) 0 var(--space-2); }
.ve-nav__item { display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: 40px; padding: 0 var(--space-3); border: 0; border-radius: var(--radius-md); background: transparent; color: var(--ink-2); font: 500 14px/20px var(--font-sans); text-align: left; text-decoration: none; cursor: pointer; }
.ve-nav__item:hover { background: var(--surface-hover); color: var(--ink); }
.ve-nav__item[aria-current="page"] { background: var(--surface-hover); color: var(--ink); font-weight: 600; }
.ve-nav__count { margin-left: auto; font: 500 12px/16px var(--font-mono); color: var(--ink-3); }

/* ---------- Modal ---------- */
.ve-modal { width: min(640px, calc(100% - 32px)); max-height: 90vh; overflow-y: auto; padding: 0; border: 0; border-radius: var(--radius-lg); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-overlay); }
.ve-modal::backdrop { background: var(--scrim); }
.ve-modal__head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--line); background: var(--surface); }
.ve-modal__head h2 { font: 600 15px/22px var(--font-sans); margin: 0; }
.ve-modal__body { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-6); }
.ve-modal__actions { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-4) var(--space-6); background: var(--surface-sunken); }

/* ---------- Empty state ---------- */
.ve-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-2); padding: var(--space-10) var(--space-6); }
.ve-empty .ve-icon-tile { margin-bottom: var(--space-2); }
.ve-empty h3 { font: 500 24px/30px var(--font-serif); letter-spacing: -.01em; margin: 0; color: var(--ink); }
.ve-empty p { font: 400 15px/24px var(--font-sans); color: var(--ink-2); max-width: 420px; margin: 0 0 var(--space-3); }

@media (prefers-reduced-motion: reduce) { .ve-root *, .ve-btn { transition: none !important; animation: none !important; } }
</code></pre>
<hr>
<h2>6. Icon system — Phosphor Icons</h2>
<ul>
<li>Install: <code>npm i @phosphor-icons/react</code> and remove <code>lucide-react</code>.</li>
<li>Weight: <code>regular</code> everywhere. Use <code>fill</code> only for the current nav item. Never use thin, light, bold or duotone.</li>
<li>Size: <strong>16</strong> next to small text (badges, meta, help text) · <strong>20</strong> in nav, inputs, notices and stat cards (18 inside buttons, which <code>components.css</code> sets) · <strong>24</strong> in empty states and page headers.</li>
<li>Colour: always <code>currentColor</code>, so the icon matches its text: <code>ink</code>, <code>ink-2</code>, <code>ink-3</code>, <code>on-primary</code> on black, <code>danger</code> in errors.</li>
<li>Placement: rules 5–7 in section 1. An icon-only button needs an <code>aria-label</code>.</li>
<li>Set defaults once:</li>
</ul>
<pre><code class="language-tsx">import { IconContext } from "@phosphor-icons/react";
&lt;IconContext.Provider value={{ size: 20, weight: "regular", color: "currentColor" }}&gt;…&lt;/IconContext.Provider&gt;
</code></pre>
<p>Add <code>className="ve-icon"</code> where the CSS sizing helpers are needed (<code>ve-icon--16</code>, <code>ve-icon--24</code>).</p>
<p><strong>Lucide → Phosphor swap list (every icon the app imports today)</strong></p>
<table>
<thead>
<tr>
<th>Lucide</th>
<th>Phosphor</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td>LayoutDashboard</td>
<td>SquaresFour</td>
<td>Overview</td>
</tr>
<tr>
<td>FolderKanban</td>
<td>Kanban</td>
<td>Projects</td>
</tr>
<tr>
<td>ClipboardList</td>
<td>Notepad</td>
<td>Updates / reports</td>
</tr>
<tr>
<td>Users</td>
<td>UsersThree</td>
<td>People</td>
</tr>
<tr>
<td>UserPlus</td>
<td>UserPlus</td>
<td>Add member</td>
</tr>
<tr>
<td>Send</td>
<td>PaperPlaneTilt</td>
<td>Submit / write an update</td>
</tr>
<tr>
<td>FlaskConical</td>
<td>Flask</td>
<td>The lab (no logo)</td>
</tr>
<tr>
<td>AlertCircle</td>
<td>WarningCircle</td>
<td>Error</td>
</tr>
<tr>
<td>CheckCircle2</td>
<td>CheckCircle</td>
<td>Saved / Accepted</td>
</tr>
<tr>
<td>Check</td>
<td>Check</td>
<td>Checklist point</td>
</tr>
<tr>
<td>Eye</td>
<td>Eye</td>
<td>Preview as member</td>
</tr>
<tr>
<td>Pencil</td>
<td>PencilSimple</td>
<td>Edit</td>
</tr>
<tr>
<td>Plus</td>
<td>Plus</td>
<td>Add</td>
</tr>
<tr>
<td>X</td>
<td>X</td>
<td>Close</td>
</tr>
<tr>
<td>Search</td>
<td>MagnifyingGlass</td>
<td>Search</td>
</tr>
<tr>
<td>Clock3</td>
<td>Clock</td>
<td>Due / time</td>
</tr>
<tr>
<td>RefreshCw</td>
<td>ArrowsClockwise</td>
<td>Refresh</td>
</tr>
<tr>
<td>LogOut</td>
<td>SignOut</td>
<td>Sign out</td>
</tr>
<tr>
<td>Menu</td>
<td>List</td>
<td>Mobile menu</td>
</tr>
<tr>
<td>ChevronRight</td>
<td>CaretRight</td>
<td>Go to</td>
</tr>
<tr>
<td>ArrowRight</td>
<td>ArrowRight</td>
<td>Go to (in buttons)</td>
</tr>
<tr>
<td>ArrowUpRight</td>
<td>ArrowUpRight</td>
<td>External / continue</td>
</tr>
<tr>
<td>ArrowDown</td>
<td>ArrowDown</td>
<td>Scroll / jump</td>
</tr>
<tr>
<td>BookOpen</td>
<td>BookOpen</td>
<td>Guide</td>
</tr>
<tr>
<td>CircleHelp</td>
<td>Question</td>
<td>Help</td>
</tr>
<tr>
<td>Activity</td>
<td>Pulse</td>
<td>Activity</td>
</tr>
</tbody>
</table>
<p>Also use these where needed: <code>Warning</code> (Blocked), <code>Tray</code> (empty list), <code>Funnel</code> (filter), <code>CalendarBlank</code> (date), <code>EnvelopeSimple</code> (email), <code>Info</code> (info).</p>
<hr>
<h2>7. Migration steps</h2>
<ol>
<li><strong>Fonts:</strong> add Source Serif 4, IBM Plex Sans and IBM Plex Mono via <code>next/font/google</code> in <code>app/layout.tsx</code>, exposed as <code>--font-serif</code>, <code>--font-sans</code> and <code>--font-mono</code> on <code>&lt;html&gt;</code>.</li>
<li><strong>Styles:</strong> add <code>app/tokens.css</code> and <code>app/components.css</code> from sections 4 and 5, import them in <code>app/layout.tsx</code>, and add <code>className="ve-root"</code> to <code>&lt;body&gt;</code>.</li>
<li><strong>Remove the old styles:</strong> delete the old rules from <code>app/globals.css</code>. Keep only layout rules that have no equivalent here (app shell grid, sidebar position, breakpoints), rewritten to use the tokens (no hex values).</li>
<li><strong>Icons:</strong> swap every Lucide import using the table in section 6, then uninstall <code>lucide-react</code>.</li>
<li><strong>Classes:</strong> replace old classes as follows:</li>
</ol>
<table>
<thead>
<tr>
<th>Old (globals.css)</th>
<th>New</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>.button.primary</code> / <code>.secondary</code> / <code>.text-button</code> / <code>.icon-button</code></td>
<td><code>ve-btn ve-btn--primary</code> / <code>--secondary</code> / <code>--ghost</code> / <code>ve-icon-btn</code></td>
</tr>
<tr>
<td><code>.eyebrow</code></td>
<td><code>ve-overline</code></td>
</tr>
<tr>
<td><code>.panel</code>, <code>.section-heading</code></td>
<td><code>ve-panel</code>, <code>ve-panel__head</code></td>
</tr>
<tr>
<td><code>.stat-card</code>, <code>.stat-card.attention</code></td>
<td><code>ve-stat</code>, <code>ve-stat--attention</code></td>
</tr>
<tr>
<td><code>.stage stage-N</code>, <code>.stage-journey</code></td>
<td><code>ve-stage</code> with <code>data-stage</code></td>
</tr>
<tr>
<td><code>.subtle-pill</code>, <code>.role-badge</code>, <code>.report-status</code></td>
<td><code>ve-badge</code> + tone from section 2</td>
</tr>
<tr>
<td><code>.priority</code></td>
<td><code>ve-priority ve-priority--p1/2/3</code></td>
</tr>
<tr>
<td><code>.avatar</code>, <code>.avatar-stack</code></td>
<td><code>ve-avatar</code>, <code>ve-avatar-stack</code></td>
</tr>
<tr>
<td><code>.projects-table</code>, <code>.project-name</code></td>
<td><code>ve-table</code>, <code>ve-table__project</code></td>
</tr>
<tr>
<td><code>.update-card</code>, <code>.blocker</code>, <code>.next-plan</code></td>
<td><code>ve-report</code>, <code>ve-report__blocker</code>, <code>ve-report__next</code></td>
</tr>
<tr>
<td><code>.person-card</code></td>
<td><code>ve-person</code></td>
</tr>
<tr>
<td><code>.success</code>, <code>.error</code>, <code>.workspace-notice</code></td>
<td><code>ve-notice</code>, <code>ve-notice--danger</code>, <code>ve-notice</code></td>
</tr>
<tr>
<td><code>.demo-banner</code>, <code>.preview-banner</code>, <code>.member-login-note</code></td>
<td><code>ve-notice--info</code> (no icon)</td>
</tr>
<tr>
<td><code>.modal</code>, <code>.modal-head</code>, <code>.modal-body</code>, <code>.modal-actions</code></td>
<td><code>ve-modal</code>, <code>__head</code>, <code>__body</code>, <code>__actions</code></td>
</tr>
<tr>
<td><code>.empty-state</code>, <code>.quiet-state</code></td>
<td><code>ve-empty</code></td>
</tr>
<tr>
<td><code>.nav-item</code>, <code>.nav-count</code></td>
<td><code>ve-nav__item</code>, <code>ve-nav__count</code></td>
</tr>
<tr>
<td><code>.search-field</code>, <code>.status-options</code></td>
<td><code>ve-search</code>, <code>ve-choice</code></td>
</tr>
<tr>
<td><code>.brand-icon</code>, <code>.action-icon</code>, <code>.small-mark</code></td>
<td><code>ve-icon-tile</code> (zinc)</td>
</tr>
<tr>
<td><code>label &gt; input</code></td>
<td><code>ve-field</code> + <code>ve-label</code> + <code>ve-input</code>/<code>ve-select</code>/<code>ve-textarea</code></td>
</tr>
</tbody>
</table>
<ol start="6">
<li><strong>Screens:</strong>
<ul>
<li><strong>App shell:</strong> a 240px sidebar on <code>surface</code> with a 1px <code>line</code> right edge. The brand is a zinc <code>ve-icon-tile</code> with <code>Flask</code> and "VE Lab" in <code>subheading</code>. A 64px top bar with breadcrumb and role badge. Content sits on <code>paper</code>, max 1440px wide.</li>
<li><strong>Overview (admin):</strong> page header with the primary action → 4 stat cards → projects table and the "Needs attention" panel side by side (about 2:1) → 3 recent report cards.</li>
<li><strong>Member home:</strong> a short welcome, then one card per assigned responsibility with a "Write an update" button (<code>--accent</code> or <code>--primary</code>).</li>
<li><strong>Report form:</strong> fields, then the status <code>ve-choice</code>, then the previous plan in a <code>ve-notice--warm</code>. One primary "Submit update" button.</li>
<li><strong>Sign-in:</strong> two halves.
<ul>
<li>Form side: <code>title-1</code> "Welcome to the lab.", one line of copy, a full-width "Continue with Google" <code>ve-btn--secondary</code> (the Google "G" mark is allowed, since it is Google's own sign-in mark).</li>
<li>Visual side: a large composition on black or blue built from real product pieces, such as a stage meter, a report card and stat numbers, plus the <code>display</code> title "More research. Less reporting." Keep words to a minimum.</li>
</ul>
</li>
<li><strong>Breakpoints:</strong> at 1250px the sidebar narrows and the 2:1 split stacks; at 900px the sidebar becomes a drawer (<code>shadow-overlay</code> over <code>scrim</code>); at 620px everything is one column and forms stack.</li>
</ul>
</li>
<li><strong>Dark mode:</strong> <code>tokens.css</code> follows the system setting automatically. Setting <code>data-theme="light"</code> or <code>"dark"</code> on <code>&lt;html&gt;</code> forces a theme.</li>
</ol>
<hr>
<h2>8. Done checklist</h2>
<ul>
<li>[ ] No hex colours outside <code>tokens.css</code>. <code>grep -rn "#[0-9a-fA-F]\{3,6\}" app components</code> finds only <code>tokens.css</code> and the Google "G" mark.</li>
<li>[ ] No <code>lucide-react</code> imports remain. All icons are Phosphor, regular weight (fill only on the active nav item).</li>
<li>[ ] No icon inside a blue or sand fill. No tinted icon tiles. No blue or sand icons.</li>
<li>[ ] No border on any filled element. Borders appear only on white-on-grey edges, dividers and unfilled controls.</li>
<li>[ ] No shadow except on modals and the mobile drawer.</li>
<li>[ ] Every status shows its word. Stage meters show name + n/7.</li>
<li>[ ] Every interactive element shows the focus ring. Icon-only buttons have <code>aria-label</code>.</li>
<li>[ ] Both themes checked: text stays readable and no element disappears.</li>
<li>[ ] No invented logo anywhere. The sign-in page follows section 7.6.</li>
<li>[ ] <code>npm run typecheck</code>, <code>npm test</code> and <code>npm run build</code> pass; <code>npm run test:e2e</code> passes after updating selectors that relied on old class names.</li>
</ul></body></html>     #                           �