# Orbit

<p align="center">
<a href="https://dash.yard.sh/projects?action=create&repo=https%3A%2F%2Fgithub.com%2Fyard-sh%2Fyard-orbit"><img src="https://yard.sh/create-in-yard.png" width="200" alt="Create in Yard" /></a>
</p>

A SaaS CRM hosted end to end on Yard. Orbit keeps contacts and the companies
they work for. Deals move across a drag-and-drop pipeline. Every note, call,
email, meeting and stage change lands on one timeline, and tasks with due
dates keep follow-ups from slipping. A dashboard shows open pipeline, a
weighted forecast, win rate and revenue won. Teams share a workspace through
one invite link. The pieces:

- **Frontend:** React 19, TypeScript, Tailwind v4 and shadcn/ui, built with
  Vite. TanStack Query fetches, TanStack Table runs the lists, dnd-kit runs
  the board, Recharts draws the charts.
- **Backend:** one fetch handler, written in TypeScript and bundled to
  `app/_service.js`.
- **Storage:** the project's SQLite database.
- **Sign-in:** Yard Auth. There is no login code in this repository.
- **Pricing:** Free for one person (250 contacts, 50 open deals). Pro is $12 a
  month, 20% less yearly, with a 14-day trial and no card: unlimited records
  and up to 25 teammates.
- **Validation:** one set of zod schemas in `web/shared/`, used by both the
  forms and the API, so the two never disagree.

Use the button above, or paste this repository's URL into the **Create from
GitHub URL** field of the Yard dashboard's Create Project dialog. What it needs
(`yard me --json`, `.team_permissions`):

- `service`, for the app and its API.
- `yard_auth`, to sign people in (the app's access is `authenticated`).
- `custom_project_pages`, for the landing page.

Once it's live:

- The landing page is at `https://<team>.yard.sh/<slug>/`.
- The app is at `https://<team>.yard.sh/<slug>/app/`.

## Layout

    .yard/
      settings.json        every project setting: the app service, landing page, pricing
      migrations/          users, workspaces, members, companies, contacts, deals,
                           tasks, activities
      landing-page/        the public page: plain HTML, CSS and JS, no build
      dev/                 local state written by yard dev; ignored by git
    app/                   BUILD OUTPUT, committed: the deployable bundle (dir: app)
      _service.js          the backend, bundled from web/server
      index.html, assets/  the React app, built from web/src
    web/                   the source; never deployed
      shared/              constants, zod schemas and API types used by both sides
      server/              the backend
        index.ts           fetch handler and route table
        identity.ts        X-Yard-* headers → the caller, and their plan snapshot
        workspace.ts       workspaces, roles, plan limits
        refs.ts            foreign keys in a request must point inside the workspace
        select.ts · sql.ts the SELECTs behind each row type; WHERE and UPDATE builders
        routes/            one file per resource, plus the sample-data seed
      src/                 the app
        lib/               fetch wrapper, query hooks, the workspace context
        components/        layout, sidebar, ⌘K menu, forms, timeline, data table
        components/ui/     shadcn/ui components, as the shadcn CLI writes them
        pages/             dashboard, contacts, companies, deals, tasks, settings, invite
      scripts/             build.mjs and dev.mjs
    tests/api.sh           API checks against yard dev

The service entry declares its mount, access mode and database:

    "services": [
      { "dir": "app", "name": "app", "url": "/app",
        "access": "authenticated", "database_access": true }
    ]

## How it fits together

**The build output is committed.** Create in Yard deploys the repository as
it is, with no build step, so `app/` must always be ready to serve.

- `npm run build` in `web/` runs Vite into `app/`, then esbuild bundles
  `web/server` into `app/_service.js`. Vite empties `app/` first, which is why
  the backend is built second.
- Commit `app/` together with the source change that produced it.
- `_service.js` is not minified. Orbit's own code is at the end, after the
  bundled zod (English messages only; the other locales are left out).

**Relative URLs and hash routes.** The app is served at `/<slug>/app/`, and
at `/<slug>/@<sandbox>/app/` in a sandbox.

- Vite builds with `base: "./"`.
- The app calls `fetch("api/…")`, never `/api/…`.
- Pages are hash routes (`#/deals/<id>`), so the service only ever serves
  `index.html` and the API.
- Sign-out is `../__yard/auth/logout?return=/`, and "upgrade" links to the
  landing page's `../#pricing`.

**Yard Auth is the only sign-in.** The service is `authenticated`, so the
edge signs people in before any request arrives.

- Requests carry trusted `X-Yard-User-Id`, `X-Yard-Email`,
  `X-Yard-Entitlement` and `X-Yard-Tier-Key` headers. The service still
  answers `401 signed_out` without a user, as a backstop.
- A session that lapses mid-use answers the app's fetches with a redirect. The
  fetch wrapper sees that and reloads the page, so the person signs back in
  and lands where they were.

**Everyone owns one workspace and joins others by invite.**

- `GET api/me` makes your workspace on your first visit. A unique index on
  `workspaces(owner_id)` keeps two racing first requests from making two.
- Every other route is under `api/workspaces/<id>/…` and resolves your
  membership first.
- A workspace you aren't in answers 404, the same as one that doesn't exist,
  so ids can't be probed. Every query filters on `workspace_id`.
- Ids in a request body (a contact's company, a deal's owner) are checked
  against the workspace before anything is written, so a record can never
  point into another workspace.

| Role   | Can |
| ------ | --- |
| Owner  | Everything. Their plan sets the workspace's limits; they can't leave or be removed. Promotes and demotes admins. |
| Admin  | Renames the workspace, sees and resets the invite link, removes members, deletes anyone's timeline entries. |
| Member | Every contact, company, deal and task. Deletes their own timeline entries. |

**One invite link per workspace.** The link is `…/app/?invite=<token>`.

- Yard signs the person in on the way, keeping the query.
- `main.tsx` moves the token into the hash route `#/invite/<token>`, which
  previews the workspace and joins on one click.
- Resetting the link revokes every copy. People who already joined stay.

**Whose plan counts.** A service only ever sees the visitor's own tier, so
a workspace runs on its owner's snapshot.

- Every request snapshots the caller's plan into `users.plan`. Members read
  the owner's.
- Pro is the project owner (`X-Yard-Entitlement: owner`), or an `active` or
  `trial` entitlement whose tier key is `pro`. That's `PRO_TIER` in
  `web/shared/constants.ts` and `key` on the tier in `.yard/settings.json`.
  Renaming the tier is safe; changing its key makes it a different tier.
- A trial carries no end date in the headers, so the snapshot gives it 14 days
  (`pro_until`). A trial that ends while its owner stays away runs out on its
  own.

**The server is the paywall.** `LIMITS` in `web/shared/constants.ts` is the
one table both sides read.

- Creating contact 251, open deal 51, or accepting an invite into a full
  workspace answers `402 plan_limit`.
- The app answers any 402 with the upgrade dialog, which sends the owner to
  the landing page's pricing.
- Reopening a won or lost deal counts as a new open deal.
- Nothing is deleted on a downgrade: a workspace over its limits keeps its
  records and can't add more.

**Deals keep their own history.**

- The board writes a card's new stage and the midpoint of its new neighbours'
  positions, so a drag rewrites one row and never renumbers a column.
- Entering Won or Lost stamps `closed_at`, which the revenue chart and win
  rate read. Leaving those stages clears it.
- Creation and every stage change are written to the timeline by the service,
  as `created` and `stage_change` entries. Nobody can delete them.

**Timelines overlap on purpose.** An activity carries up to three subjects.

- An entry logged on a deal also records the deal's contact and company, so
  it shows on all three timelines.
- An entry logged on a contact also records their company.
- Deleting a record clears it from its entries. An entry that no longer
  belongs to anything is deleted.

**One cache, refreshed whole.** Every query key starts with
`["ws", <workspace id>]`.

- Switching workspaces never shows another workspace's data.
- Any write invalidates its workspace's queries. CRM records are
  interlinked (moving a deal changes the dashboard, the company's open value
  and the contact's timeline), so refreshing everything is the simplest
  correct choice at this size.

Two details worth knowing before editing:

- **Migrations are not transactional.** A failed statement leaves the earlier
  ones applied and the file unrecorded, so every statement in
  `0001_init.sql` is idempotent (`IF NOT EXISTS`). Add a new numbered file
  for schema changes; never edit an applied one.
- **Foreign keys aren't enforced.** SQLite leaves them off, so deletes clear
  references explicitly in a batch (see "Data lifecycle").

## Free and Pro

|                          | Free | Pro |
| ------------------------ | ---- | --- |
| Contacts                 | 250 | Unlimited |
| Open deals               | 50 | Unlimited |
| People in the workspace  | 1 | 25 |
| Pipeline, tasks, timelines, dashboard | ✓ | ✓ |

Pro is $12 a month or $115.20 a year, with a 14-day trial and no card. The
landing page fills names, prices, features and the trial button from
`window.yard.project.tiers`, matched by tier key, so it never disagrees with
checkout.

## Local development

Two terminals:

    yard dev                             # from the repository root
    cd web && npm install && npm run dev

`yard dev` serves the landing page at `http://localhost:9875/orbit/` and the
app at `http://localhost:9875/orbit/app/`. It applies the migration to a
local database and stamps identity headers from a persona.

`npm run dev` rebuilds `app/` on every save (frontend and backend). Reload
the tab to see a change.

There is no sign-up screen and no login code in this repo: Yard Auth signs
people in and hands the service trusted `X-Yard-*` headers. Locally, a
**persona** stands in for it, and each persona is a different person:

| Persona     | Who they are                                      |
| ----------- | ------------------------------------------------- |
| `member`    | you, the project owner (Pro limits)               |
| `signed-in` | someone who just signed in, without buying (Free) |
| `user:free` | someone on the Free tier                          |
| `user:pro`  | a Pro subscriber                                  |
| `trial`     | someone on the 14-day Pro trial                   |

- **Switching:** switch at `http://localhost:9875/orbit/app/__yard/auth/login`,
  or start with `yard dev --as user:pro`.
- **Sample data:** an empty workspace's dashboard offers **Load sample data**:
  8 companies, 16 people, 16 deals across every stage over the last six
  months, tasks and timeline entries.
- **Teams:** open the app in a normal window and a private window, pick
  `user:pro` in one and `signed-in` in the other, and open the Pro workspace's
  invite link (Settings → Members) in the second.
- **Fresh start:** `yard dev --reset-db` starts from an empty database.

Other scripts in `web/`: `npm run typecheck` and `npm run format`. shadcn
components are added with `npx shadcn add <component>`, which writes into
`src/components/ui/`.

## Testing

    yard dev --reset-db      # in another terminal
    tests/api.sh

`tests/api.sh` (curl and jq) drives the API as four personas, and reads the
local database through the yard dev control panel. It checks:

- workspace provisioning, sample data and the dashboard
- search, filters and validation errors
- isolation between workspaces, including foreign keys in request bodies
- the Free limits and the 402s they answer with
- invites, roles and leaving
- deal moves and the timeline they write
- tasks, and what deletes leave behind

## Logging

    yard service logs --since 2h
    yard service logs --since 2h | grep deal.move

Every line starts with `[orbit]` and is one event:

    [orbit] deal.move ws=3f0c1a2e deal=9b41d0c7 from=lead to=qualified
    [orbit] limit.reached ws=3f0c1a2e limit=contacts cap=250
    [orbit] request method=POST path=/api/workspaces/3f0c1a2e/deals/9b41d0c7/move status=200 user=dev-pers ms=6

**Events:**

- `request`, `plan.changed`, `me.rename`
- `workspace.provision|rename|seed`, `invite.reset|accept`
- `member.role|remove|leave`, `limit.reached`
- `contact|company|deal|task.create|update|delete`
- `deal.move`, `activity.create|delete`

Failures go to `console.error` as `request.failed`.

**Not logged:** names, emails, notes, deal titles or any other CRM content;
lengths are logged instead. Ids are cut to 8 characters everywhere, request
paths included.

## Shipping

    cd web && npm run build && cd ..    rebuild app/ (commit it)
    yard service check                  validate bundle + lint, no network
    yard push                           upload service, page and settings into the draft
    yard releases publish <tag>         publish the draft, which makes it live
    yard service open                   print/open the live app URL
    yard db query "select stage, count(*) from deals group by stage"
    yard service logs --since 2h

Nothing serves a draft release, so pushing is safe to repeat. Migrations apply
themselves at deploy. To try a release before anyone else sees it:

    yard sandbox create preview
    yard sandbox pin                            hold the project on what it serves
    yard releases publish <tag>
    yard sandbox pin <tag> --sandbox preview
    yard service open --sandbox preview         team-only URL
    yard sandbox unpin                          go live

A sandbox has its own database and its own simulated checkout, so Pro can be
bought and used there without money moving.

## Data lifecycle

- **Deleting a contact:** their deals and tasks stay, without a contact.
  Timeline entries that were only theirs go.
- **Deleting a company:** its people, deals and tasks stay, no longer filed
  under it. Timeline entries that were only its go.
- **Deleting a deal:** its tasks stay, unlinked. Its history goes, and so do
  entries that were only on it.
- **Removing a member, or a member leaving:** the records they own stay,
  still assigned to them, until someone reassigns them.
- **Workspaces** are never deleted. Everyone keeps their own.
