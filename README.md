# serverless-github-cms
Serverless CMS built with Cloudflare Workers, D1, GitHub OAuth, and GitHub APIs. Includes live site previews, visual CSS editing, image/media management, database-backed content editing, public read-only APIs, and GitHub-based deployment workflows.


CMS Setup Text Guide.

# Deploying the template

Cloudflare

account home: click on create an app.

under account details: change your subdomain to your username (optional but better than a random URL)

go to account home then under ship something new, click on create app.

choose select a template, then click on browse all templates.

scroll down and click on Worker + D1 Database, click on deploy to Cloudflare on the top right.

you are now in the set up your application section.

click on new GitHub connection (make sure you are signed into GitHub on this browser)

in the new opened tab, make sure the box is ticked for "all repositories" then click on install & authorize.

now back in the setup your app tab, click the drop down and choose your GitHub account.

tick the box to make the repo private. (leave the section in select database to "create new")

Project name: worker-d1
database name: d1-database

click deploy (leave everything else to its default)

if it gets stuck then refresh the page and look for a success message at the bottom of the logs.

go to your list of repos in GitHub and look for worker-d1 to confirm the deployment.
if you only have 2 files in the repo then you have a template deploy bug. (I have a text guide for this.)

click on "workers and pages" in the left column and click on your new worker-d1

click the domains section and enable the tick box for the production domain

click on the blue visit button on the top right of the page within this worker.
a new tab should open and say it has been connected

copy this URL and paste it into the "info you will need" text file (place this in the worker URL section)

go to the storage & databases section in the left pane of the site and then open D1 SQLite Database

click on d1-database to open it, copy the string that's under the overview and settings section (this is our database ID. copy and paste this into our info txt file in the DB ID section.
---------------------------------------------------------------------------------------------------------------------
---------------------------------------------------------------------------------------------------------------------

# Creating Cloudflare secrets - Oauth - PAT token etc


in the info text file you can see 3 values we need to create that say "random". paste this command into PowerShell and run it 3 times to create 3 random strings, copy and paste these 3 strings into:

(PowerShell): "[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))"

copy that without the quotes but make sure to copy what's within the quotes

ADMIN_TOKEN
SESSION_SECRET
USERNAME_TOKEN

it does not matter which one you put the strings into, any 3 will do.

go to GitHub and click on your profile picture in the top right then click on settings.

scroll all the way down and open developer settings in the left pane.

click on OAuth Apps then click on the new app button

application name: oauth-app

copy and paste your worker URL from the info text file into the homepage URL box and the redirect URL box:

both URL's will be the same BUT the homepage URL will end with /cms and the redirect URL will end with /oauth/callback

it would look like:

homepage: https://worker-d1.USERNAME.workers.dev/cms    (/cms)

callback url: https://worker-d1.USERNAME.workers.dev/oauth/callback    (/oauth/callback)

click on the green register application button at the bottom.

on the next page copy and paste the client ID into the info text file.

click the generate a new client secret button and copy and paste its value into the info text file.

go back to developer settings then open personal access tokens then click on fine grained tokens then click the green generate new token button.

token name: CMS

choose no expiration date.

for extra security and ease of use you should click on "only select repositories" then tick the box that would be the repo to your website on GitHub pages.

next click on add permissions and then enable all the available tick boxes.

in the permissions box click the dropdown on every section and choose read and write for every option.

click the green generate token button at the bottom of the page

the next page will show you your personal access token (PAT). copy and paste this into the info text file.
-------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------

# Cloning your worker repo and editing code


open GitHub desktop and clone the worker-d1 repo you have created. then click on the show in explorer button and throw this window to the left of the screen. (we are going to open another explorer "file manager" window and have them side by side to easily copy and replace and edit some files.)

my project that you have downloaded should have a "worker-d1-main" folder, open it side by side with your cloned repo.

so you should have your cloned repo folder open with my repo folder that you have downloaded.

open the worker-d1-main folder on the downloaded version.

copy and replace the wrangler.json file into your repo and replace the existing one (copy and replace, or you can delete your wrangler file then copy mine into your repo, you do you.)

next, open your repos migrations folder and delete what's in there then copy my files from my migrations folder into yours ("my" meaning the version you downloaded)

now open the src folders, delete all files inside of yours and replace with mine.

open up VS-code and open the files:

wrangler.json
index.ts
page.ts
script.ts
worker-d1-public.txt

all of those files should be open inside of your code editor (note: worker-d1-public.txt does not go inside your repos folders, leave it in the code editor only, we will paste this into Cloudflare later.)


I have included a what-to-edit.md file that lists which files to edit and which section of code you need to modify.
all of the required information will be inside of your info text file you added to. you can search for the term "placeholder" and pan down for the majority of these edits.

when you are done, click on file then click on save all.

open up GitHub desktop, add a comment and then click commit to main then click push origin

------------------------------------------------------------------------------------------------------


# creating our public worker

open up Cloudflare and in the left pane open compute then workers & pages

click the blue create application button on the top left (we are making the public worker URL)

click on start with hello world.

worker name: worker-d1-public

click the blue deploy button on the bottom.

click the edit code button on the top right, remove the existing code then copy and paste the code in from worker-d1-public.txt

click on deploy on the top right.

click on the Bindings tab on the top then click the blue Add binding + button.

this section should open the D1 database tab, click on add binding on the bottom of this menu pop up.

variable name: public
D1 database dropdown: choose "d1-database"

click on add binding

you can open up this binding and click on the explore data button then open the menu_items on the left, this was auto-populated from our migrations files so if you need to edit the SQL DB this is where.

------------------------------------------------------------------------------------------------------

# Adding secrets to Cloudflare

open up your worker-d1 from workers & pages (under the compute section or account home)

go to the settings tab and under "variables and secrets" (env) click the + add variable button.

you are now going to add everything from the info text file into this

your allowed login and github-oauth-client-id will be a text value, everything else you need to tick the box to make them a secret.

example:

Key: ADMIN_TOKEN
Value:uuRU/NrGacTCdzxz70pRS+CokSZX3USYUnYlOaMF9Qo=

after this when you open up your worker URL it should now load the CMS, you can click the blue visit button.

make sure to use the public worker URL on websites you create as it's read only on the SQL DB.

You now have a serverless CMS protected with GitHub authentication and Cloudflare!


<img width="943" height="590" alt="Screenshot 2026-08-13 161553" src="https://github.com/user-attachments/assets/b5192ec7-e452-47a9-b5b5-fe564f79bdf8" />

------------------------------------------------------------------------------------------------------

# Disclaimers

PAT permissions:
The CMS should only require "Contents: Read and write" and "Metadata: Read-only" for the selected website repository. Using only these permissions instead of enabling all permissions has not been fully tested yet. Using a PAT with no expiration is not recommended for security, but it can make client handoff easier because the token will not need to be renewed later.

PowerShell random values:
For stronger random secrets, use this command instead of the Get-Random command shown above:

[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

This uses a cryptographically secure random number generator, which is better suited for security tokens and session secrets.

