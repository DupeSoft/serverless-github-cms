worker-d1-public.txt:



&#x20;\*   Database ID        = YOUR-DB-ID

\---------------------------------------------



wrangler.json:



&#x20;   "ALLOWED\_LOGIN": "**YOUR-USERNAME-HERE**",

&#x20;   "GITHUB\_OAUTH\_CLIENT\_ID": "**INSERT-OAUTH-ID-HERE**"

&#x20; },



&#x20; "upload\_source\_maps": true,

&#x20; "d1\_databases": \[

&#x20;   {

&#x20;     "binding": "DB",

&#x20;     "database\_id": "INSERT-DB-ID-HERE",

&#x20;     "database\_name": "d1-database"

\------------------------------------------------------



index.ts:



&#x20;   (x: any) => x \&\& x.full\_name === "**USERNAME-PLACEHOLDER**/**REPOPLACEHOLDER**"



\------------------------------------------------------------------------------------



page.ts:



&#x20;           <h2>Images (**USERNAME-PLACEHOLDER**/**REPO-PLACEHOLDER**/images/)</h2>



\--------------------------------------------------------------------------------------



script.ts:



"// ============= CONFIG =============\\n",

"const APIBASE = 'https://worker-d1.**YOUR-USERNAME-PLACEHOLDER**.workers.dev';\\n",

"const GITHUB\_USER = \\"**USERNAME\_PLACEHOLDER**\\";\\n",

"const GITHUB\_REPO = \\"**PAGES-REPO\_PLACEHOLDER**\\";\\n",

"const DEFAULT\_REF = \\"main\\";\\n",

"const IMAGES\_FOLDER = \\"images\\";\\n",





"url === 'https://worker-d1-public.**YOUR-USERNAME-PLACEHOLDER**.workers.dev/' ||\\n",  // url with forward slash / at the end

"url.indexOf('https://worker-d1-public.**YOUR-USERNAME-PLACEHOLDER**.workers.dev') === 0\\n",   // url without a slash at the end





"url === 'https://worker-d1-public.**YOUR-USERNAME-PLACEHOLDER**.workers.dev/' ||\\n", // url with forward slash / at the end

"url.indexOf('https://worker-d1-public.**YOUR-USERNAME-PLACEHOLDER**.workers.dev') === 0\\n", // url without a slash at the end



\----------------------------------------------------------------------------------------------------------------------------------











script.js (website)



&#x20; // Fetch from your Worker (change URL if deployed!)

&#x20; fetch('https://worker-d1-public.**YOUR-NAME-PLACEHOLDER**.workers.dev/')



&#x20; // ========== END DYNAMIC MENU RENDERING ==========

&#x20; fetch('https://worker-d1-public.**YOUR-NAME-PLACEHOLDER**.workers.dev/')







