# SparkEd: Meteor Upgrade Plan (2.13 → 3.x)

## Context

SparkEd is a legacy Meteor 2.13 educational platform with React 17, FlowRouter, and several deprecated Atmosphere packages. The goal is to upgrade to the latest Meteor 3.x (which removes Fibers entirely, requires Node 20+, and uses async/await throughout) while keeping the app functional at each step.

**Strategy:** Incremental upgrade — Meteor 2.13 → 2.16 → 3.x. Meteor 2.16 supports both Fibers AND async APIs, so we can migrate code gradually before the final jump to 3.x.

**References:**
- [Meteor 3.0 Migration Guide](https://v3-migration-docs.meteor.com/)
- [Breaking Changes](https://v3-migration-docs.meteor.com/breaking-changes/)
- [Upgrading Packages](https://v3-migration-docs.meteor.com/breaking-changes/upgrading-packages)
- [Gradual Upgrade Guide](https://dev.to/meteor/gradually-upgrading-a-meteorjs-project-to-30-5aj0)

---

## Route Map (for verification)

All 34 routes that must keep working after every phase:

**Public:** `/login`, `/register`, `/home`, `/search`, `/fileupload`
**Auth-conditional (depends on `config.isUserAuth`):** `/`, `/view_resource/:_id`, `/contents/:_id`, `/contents/`, `/results`, `/sync`, `/dashboard/units/`, `/dashboard/feedback`, `/dashboard/slides`, `/externallinks`, `/user_details/:_id`, `/dashboard/updates`, `/reference`, `/reference/:_id`, `/dashboard/backup`, `/testunits`
**Logged-in only:** `/notifications`, `/externallinkpages`
**Admin only:** `/setup`, `/dashboard/edit_resources/:_id`, `/dashboard/isHighSchool/edit_unit/:_id`, `/dashboard/edit_unit/:_id`, `/dashboard/units/:_id`, `/dashboard/units/prog/:_id`, `/dashboard/unit/:_id`, `/dashboard/accounts`, `/dashboard/extra`, `/dashboard/overview`, `/dashboard/list_topics`, `/dashboard/course/:_id`, `/dashboard/course`, `/dashboard/stats`, `/dashboard/view_resource/:_id`
**404:** any unknown path

---

## Prompt 1: Preparation + Meteor 2.16 Upgrade

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 0 + Phase 1 from UPGRADE_PLAN.md.

Read UPGRADE_PLAN.md first for full context.

## Phase 0: Preparation

1. Create a new git branch `upgrade/meteor-3` from `master`
2. Update CI `.github/workflows/main.yml`:
   - Change node version matrix from ['10', '12'] to ['14', '18']
   - Update `actions/checkout@v1` → `actions/checkout@v4`
   - Update `actions/setup-node@v1` → `actions/setup-node@v4`
3. Delete `.travis.yml` (dead config, references Node 8.11.4)
4. Remove `babel-runtime` (version ^6.26.0) from `package.json` dependencies — we already have `@babel/runtime@^7`

## Phase 1: Upgrade to Meteor 2.16

1. Change `.meteor/release` from `METEOR@2.13` to `METEOR@2.16`
2. Run `meteor update` to resolve package version constraints
3. Run `meteor npm install` to ensure npm deps are in sync

## Guards — run these checks BEFORE committing:

1. Run `npm run lint` and fix any new lint errors
2. Run `meteor run` and confirm it starts without crash (wait for "App running at" message, then Ctrl+C)
3. Grep the codebase for any remaining `babel-runtime` imports (there should be none outside node_modules)

Commit each phase separately with descriptive messages. Do NOT push to remote.
```

---

## Prompt 2: Replace Deprecated Non-Router Packages

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 2 from UPGRADE_PLAN.md.
We are on branch `upgrade/meteor-3`, Meteor 2.16.

Read UPGRADE_PLAN.md first for full context.

## Phase 2: Replace deprecated Atmosphere packages (NOT the router — that's Phase 3)

Do these one at a time, verifying the app still compiles after each:

### 2.1 Replace `http` with `fetch`
- Files: `imports/api/sync/syncFile.js`, `imports/api/sync/methods.js`
- Replace `HTTP.call()`, `HTTP.post()`, `HTTP.get()` with native `fetch()`
- In `.meteor/packages`, replace `http` with `fetch`
- On Meteor 2.16, `await` inside Fiber context works via Promise.await

### 2.2 Replace `meteorhacks:picker` with `WebApp.connectHandlers`
- File: `imports/api/sync/syncFile.js` (4 Picker routes + middleware)
- The file already uses `WebApp.connectHandlers.use()` in some places — convert all Picker routes to the same pattern
- Remove `meteorhacks:picker` from `.meteor/packages`

### 2.3 Replace `percolate:synced-cron` with npm `node-cron`
- File: `imports/api/crons.js`
- Install: `meteor npm install node-cron`
- Remove `percolate:synced-cron` from `.meteor/packages`

### 2.4 Replace `momentjs:moment` (Atmosphere) with npm `dayjs`
- Find all files using `moment` (it's a global from the Atmosphere package)
- Install: `meteor npm install dayjs`
- Replace usage — dayjs has near-identical API for basic formatting
- Remove `momentjs:moment` from `.meteor/packages`

### 2.5 Replace `fortawesome:fontawesome@4.7.0` with npm equivalent
- Install: `meteor npm install font-awesome@4.7.0`
- Add CSS import in `client/main.js`: `import 'font-awesome/css/font-awesome.min.css';`
- Remove `fortawesome:fontawesome` from `.meteor/packages`
- Keep FA4 class names (`fa fa-xxx`) as-is to avoid a massive rename

### 2.6 Remove `underscore` from `.meteor/packages`
- Search for `_.` usage in project files (not node_modules)
- Replace with lodash (already a dependency) or native JS array methods
- Add explicit `import _ from 'lodash';` where needed

### 2.7 Remove `jquery` from `.meteor/packages`
- Verify no component code uses `$()` or `jQuery`
- Remove from `.meteor/packages`

### 2.8 Replace `lfergon:exportcsv`
- File: `imports/api/statistics/csvMethods.js`
- Install: `meteor npm install papaparse`
- Remove `lfergon:exportcsv` from `.meteor/packages`

### 2.9 Remove `meteortoys:allthings` from `.meteor/packages`

### 2.10 Upgrade `aldeed:collection2-core` → `aldeed:collection2`
- In `.meteor/packages`, replace `aldeed:collection2-core` with `aldeed:collection2`
- The `attachSchema` API stays the same — no changes needed in collection files
- `simpl-schema` npm package (already at v3.4.6) is compatible

## Guards — run after ALL changes:

1. Run `npm run lint` and fix any new lint errors
2. Run `meteor run` and confirm it starts without crash (wait for "App running at" message, then Ctrl+C)
3. Grep for any remaining references to removed packages:
   - `grep -r "meteorhacks:picker\|Picker\." imports/ server/ client/` (should find nothing)
   - `grep -r "percolate:synced-cron" imports/ server/` (should find nothing)
   - `grep -r "momentjs:moment" .meteor/packages` (should find nothing)
   - `grep -r "HTTP\." imports/ server/` (should find nothing except comments)
4. Verify `.meteor/packages` no longer contains any of: `http`, `meteorhacks:picker`, `percolate:synced-cron`, `momentjs:moment`, `fortawesome:fontawesome`, `underscore`, `jquery`, `lfergon:exportcsv`, `meteortoys:allthings`, `aldeed:collection2-core`

Commit with a descriptive message. Do NOT push to remote.
```

---

## Prompt 3: Router Migration (FlowRouter → React Router)

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 3 from UPGRADE_PLAN.md.
We are on branch `upgrade/meteor-3`, Meteor 2.16. Deprecated packages were replaced in Phase 2.

Read UPGRADE_PLAN.md first for full context, especially the "Route Map" section which lists all 34 routes.

## Phase 3: Migrate FlowRouter → React Router v6

This is the largest change. There are 34 routes in `client/routes.js` and ~50 component files that reference FlowRouter APIs.

### 3.1 Install React Router
- Run: `meteor npm install react-router-dom@^6`

### 3.2 Create `client/AppRouter.jsx`
- Create a new React Router configuration that maps ALL 34 routes from `client/routes.js`
- Three auth levels exist:
  - `exposed` — public routes (no auth needed)
  - `loggedIn` — requires `Meteor.userId()`
  - `adminRoutes` — requires `Meteor.userId()` AND role `content-manager` or `admin`
  - `isAuthRequired()` — conditionally public OR loggedIn based on `config.isUserAuth`
- Create `<RequireAuth>` and `<RequireAdmin>` wrapper components using `<Outlet>`
- Create `<ConditionalAuth>` for the `isAuthRequired()` pattern that checks `config.isUserAuth`
- Use the same component + prop structure (e.g., `<WrappedSidenav yield={<Component />} isAtCourse={true}>`)

### 3.3 Create a `withRouter` HOC
Many components are class-based and use `FlowRouter.getParam()` etc. Create a HOC:
```jsx
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
export function withRouter(Component) {
  return function WrappedComponent(props) {
    const params = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    return <Component {...props} params={params} navigate={navigate} searchParams={searchParams} />;
  };
}
```

### 3.4 Replace FlowRouter usage in ALL component files
Search for every file that imports or uses FlowRouter and convert:
- `FlowRouter.getParam('_id')` → `this.props.params._id` (class) or `useParams()` (function)
- `FlowRouter.go('/path')` → `this.props.navigate('/path')` (class) or `navigate('/path')` (function)
- `FlowRouter.getQueryParam('q')` → `this.props.searchParams.get('q')` (class) or `useSearchParams()` (function)
- `FlowRouter.current().path` → `window.location.pathname` or `useLocation()`
- Wrap class components that need router props with `withRouter()`

### 3.5 Update `client/main.js`
- Remove FlowRouter initialization block (FlowRouter.wait(), Tracker.autorun with FlowRouter.initialize)
- Import and render `<AppRouter />` using ReactDOM

### 3.6 Remove old packages
- Remove `kadira:flow-router` and `kadira:blaze-layout` from `.meteor/packages`
- Remove `@olivierjm/react-mounter` from `package.json`
- Run `meteor npm install` to clean up

## Guards — CRITICAL for this phase:

1. Run `npm run lint` and fix errors
2. Run `meteor run` and confirm it starts
3. Verify EVERY route from the Route Map in UPGRADE_PLAN.md still resolves to the correct component. List them out and confirm the mapping:
   - `/login` → Login
   - `/register` → Register
   - `/home` → Landing
   - `/search` → SearchPage
   - `/` → Home (inside AppWrapper)
   - `/contents/:_id` → ContentsApp (inside AppWrapper)
   - `/view_resource/:_id` → ViewResourceApp (inside AppWrapper)
   - `/dashboard/accounts` → ManageAccounts (inside WrappedSidenav)
   - `/dashboard/overview` → OverView (inside WrappedSidenav)
   - ... and ALL other routes
4. Grep for any remaining FlowRouter references:
   - `grep -r "FlowRouter" imports/ client/ server/` (should find NOTHING)
   - `grep -r "react-mounter" imports/ client/` (should find NOTHING)
5. Verify the 404/NotFound route works for unknown paths

Commit with a descriptive message. Do NOT push to remote.
```

---

## Prompt 4: Fiber Removal & Async Migration

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 4 from UPGRADE_PLAN.md.
We are on branch `upgrade/meteor-3`, Meteor 2.16. Router was migrated to React Router in Phase 3.

Read UPGRADE_PLAN.md first for full context.

## Phase 4: Remove Fibers and convert to async/await

Meteor 2.16 supports BOTH sync (Fibers) and async APIs side by side. We convert everything to async now so Phase 5 (Meteor 3.x) goes smoothly.

### 4.1 Remove explicit Fiber usage in `imports/api/sync/syncFile.js`
- Remove `Fiber = require('fibers');` (line ~21)
- Convert `Fiber(function() { Meteor.call('downloadResource'); }).run();` → `await Meteor.callAsync('downloadResource');`
- Convert the other Fiber block with `Meteor.call('updateSysVersion')` similarly
- Convert callback-based `fs.stat` / `exec` to `fs.promises.stat` / `util.promisify(exec)`

### 4.2 Convert ALL Meteor methods to async

Every `Meteor.methods({})` handler across these 19 files must become `async`:

- `imports/api/sync/syncFile.js` (21 methods — largest file)
- `imports/api/sync/methods.js`
- `imports/api/units/methods.js`
- `imports/api/topics/methods.js`
- `imports/api/courses/methods.js`
- `imports/api/resources/methods.js`
- `imports/api/settings/methods.js`
- `imports/api/settings/settingMethods.js`
- `imports/api/accounts/methods.js`
- `imports/api/notifications/methods.js`
- `imports/api/bookmarks/methods.js`
- `imports/api/feedback/methods.js`
- `imports/api/search/methods.js`
- `imports/api/Deleted/methods.js`
- `imports/api/externallink/methods.js`
- `imports/api/statistics/csvMethods.js`
- `imports/api/languages/methods.js`
- `imports/api/Log/logger.js`
- `server/config.js`

Pattern:
```javascript
// BEFORE:
myMethod(arg) {
  const doc = Collection.findOne({ _id: arg });
  Collection.update(arg, { $set: { field: value } });
}
// AFTER:
async myMethod(arg) {
  const doc = await Collection.findOneAsync({ _id: arg });
  await Collection.updateAsync(arg, { $set: { field: value } });
}
```

### 4.3 Convert ALL collection operations to async variants
- `findOne()` → `findOneAsync()`
- `insert()` → `insertAsync()`
- `update()` → `updateAsync()`
- `remove()` → `removeAsync()`
- `find().fetch()` → `find().fetchAsync()`
- `find().count()` → `find().countAsync()`

Do this in method files AND in `server/config.js`, `imports/api/resources/resources.js`, etc.

NOTE: Client-side collection operations in React components using `withTracker`/`useTracker` do NOT need async conversion — only server-side code.

### 4.4 Convert `Meteor.call()` inside server code to `Meteor.callAsync()`
- In `syncFile.js`, server methods that call other methods via `Meteor.call()` should use `await Meteor.callAsync()`
- In WebApp connect handlers, same pattern

### 4.5 Convert `Meteor.bindEnvironment` callbacks
- `server/config.js` and `imports/api/resources/resources.js` use this — review and convert to async patterns

## Guards — CRITICAL:

1. Run `npm run lint` and fix errors
2. Run `meteor run` and confirm it starts without crash
3. Run these grep checks to ensure completeness:
   - `grep -rn "require('fibers')" imports/ server/ client/` → should find NOTHING
   - `grep -rn "Fiber(" imports/ server/ client/` → should find NOTHING
   - `grep -rn "\.findOne(" imports/api/ server/` → should find NOTHING on server-side method files (only client-side withTracker is OK)
   - `grep -rn "\.insert(" imports/api/ server/` → should find NOTHING in method handlers (only schema definitions and client code OK)
   - `grep -rn "\.update(" imports/api/ server/` → should find NOTHING in method handlers
   - `grep -rn "\.remove(" imports/api/ server/` → should find NOTHING in method handlers
   These greps are approximate — use judgment. The point is no sync collection ops remain in Meteor method handlers or server code.
4. Verify `meteor run` still starts and the app loads in browser

Commit with a descriptive message. Do NOT push to remote.
```

---

## Prompt 5: Upgrade to Meteor 3.x

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 5 from UPGRADE_PLAN.md.
We are on branch `upgrade/meteor-3`, Meteor 2.16. All Fibers and sync collection ops were removed in Phase 4.

Read UPGRADE_PLAN.md first for full context.

## Phase 5: Upgrade Meteor 2.16 → 3.x

### 5.1 Update Meteor release
- Change `.meteor/release` to `METEOR@3.1` (or latest stable 3.x)
- Run `meteor update --release 3.1`
- Resolve any package constraint errors

### 5.2 Update Atmosphere packages for Meteor 3 compatibility
These packages need specific Meteor 3 versions:
- `alanning:roles` → `4.0.0+` (API changes: `Roles.userIsInRole()` → `await Roles.userIsInRoleAsync()`)
- `ostrio:files` → `3.0.0+` (async callbacks in `onAfterUpload`, `interceptDownload`, etc.)
- `react-meteor-data` → `2.7+` (supports async `useTracker`)
- `aldeed:collection2` → `4.0.0+`
- `universe:i18n` → check for Meteor 3 compatible version

Update ALL auth checks that use `Roles.userIsInRole()` to use async version.

### 5.3 Replace `gridfs-stream` with native `GridFSBucket`
- File: `imports/api/resources/resources.js`
- `gridfs-stream` npm package is deprecated
- Replace with MongoDB native GridFSBucket:
  ```javascript
  const db = MongoInternals.defaultRemoteCollectionDriver().mongo.db;
  const bucket = new MongoInternals.NpmModule.GridFSBucket(db);
  ```
- Update the `ostrio:files` `onAfterUpload` and `interceptDownload` hooks accordingly

### 5.4 Remove packages not needed in Meteor 3
- `es5-shim` — not needed with modern browsers
- Check if `session` can be removed (138 usages — if too many, keep for now and remove in Phase 6)
- Remove any remaining Blaze-related transitive packages

### 5.5 Update Docker
- `Dockerfile`: change `FROM node:14-alpine` → `FROM node:20-alpine`
- `docker-compose.yml`: change `image: mongo:4.4` → `image: mongo:7.0`
- Update build commands in Dockerfile if needed for Meteor 3 build process

### 5.6 Update CI
- `.github/workflows/main.yml`: change node matrix to `['20']`
- Update Meteor install command if needed

## Guards:

1. Run `npm run lint` and fix errors
2. Run `meteor run` and confirm Meteor 3 starts without errors
3. Verify in browser: login, navigate to `/`, `/dashboard/overview`, `/contents/:_id` with a real ID
4. Test file upload if possible
5. Check console for deprecation warnings — there should be none about Fibers or sync APIs
6. Run `meteor build --directory /tmp/sparked-build --server-only` to verify production build works
7. If Docker is available: `docker-compose build` and `docker-compose up` to verify full stack

Commit with a descriptive message. Do NOT push to remote.
```

---

## Prompt 6: React 18 Upgrade

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 6 from UPGRADE_PLAN.md.
We are on branch `upgrade/meteor-3`, now running Meteor 3.x.

Read UPGRADE_PLAN.md first for full context.

## Phase 6: Upgrade React 17 → 18 + Modernization

### 6.1 Upgrade React
- In `package.json`, change:
  - `"react": "^17.0.2"` → `"react": "^18.2.0"`
  - `"react-dom": "^17.0.2"` → `"react-dom": "^18.2.0"`
- Run `meteor npm install`

### 6.2 Update React root rendering
- Find where `ReactDOM.render()` is called (likely `client/main.js` or the router setup)
- Replace with `createRoot` API:
  ```javascript
  import { createRoot } from 'react-dom/client';
  const root = createRoot(document.getElementById('react-target'));
  root.render(<AppRouter />);
  ```

### 6.3 Verify third-party React packages work with React 18
Check and update if needed:
- `react-player@^2.12.0` — should work with React 18
- `react-color@^2.19.3` — should work
- `react-paginate@^8.2.0` — should work
- `react-countup@^6.4.2` — should work
If any are incompatible, upgrade to their latest versions.

### 6.4 Start converting withTracker → useTracker (incremental)
- `withTracker` HOC still works with react-meteor-data 2.7+, so this is NOT blocking
- Convert a few key components to demonstrate the pattern:
  - Pick 3-5 simpler components that use `withTracker` and convert them to function components with `useTracker`
  - Leave the rest for future work — document which ones still need conversion

### 6.5 Replace Session usage with React Context (incremental)
- `Session` has 138 usages across 24 files — too many for one pass
- Create a `ThemeContext` for the color/theme Session variables set in `client/main.js`
- Convert the most critical Session usages (theme colors, dark mode)
- Leave remaining Session usages for future cleanup — document which files still use Session

## Guards:

1. Run `npm run lint` and fix errors
2. Run `meteor run` and confirm it starts
3. Open browser — check for console errors about:
   - `ReactDOM.render is no longer supported in React 18` (should be gone)
   - Any component rendering errors
4. Navigate through key routes: `/`, `/login`, `/dashboard/overview`, `/contents/:_id`
5. Test interactive features: forms, modals, pagination, video player, color picker
6. Grep: `grep -rn "ReactDOM.render" client/ imports/` → should find NOTHING

Commit with a descriptive message. Do NOT push to remote.
```

---

## Prompt 7: Build Tooling Cleanup

> Copy and paste the prompt below into a new Claude Code session:

```
We are upgrading the SparkEd Meteor app. This is Phase 7 (final) from UPGRADE_PLAN.md.
We are on branch `upgrade/meteor-3`, Meteor 3.x, React 18.

Read UPGRADE_PLAN.md first for full context.

## Phase 7: Build Tooling Cleanup

### 7.1 Upgrade ESLint
- Replace `eslint@^7.32.0` with `eslint@^8` (v9 uses flat config which is a bigger migration — v8 is safer)
- Replace `babel-eslint@^10.1.0` with `@babel/eslint-parser`
- Update `eslint-config-airbnb`, `eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y` to latest
- In `.eslintrc.yml`:
  - Change `parser: babel-eslint` → `parser: '@babel/eslint-parser'`
  - Remove globals for `FlowRouter`, `Picker`, `moment`, `_` (no longer global)
  - Keep `Meteor`, `Roles`, `Session` globals if still used

### 7.2 Clean up dead code
- Delete `imports/api/sync/endpoint.js` (dead — uses commented-out `mrest:restivus`)
- Delete `.travis.yml` if it still exists

### 7.3 Update Dockerfile for Meteor 3
- Ensure the Dockerfile build process works with Meteor 3 and Node 20
- Test: `docker-compose build`

### 7.4 Update Gitpod config
- `.gitpod.Dockerfile`: update Meteor install to v3
- `.gitpod.yml`: verify port configuration still correct

### 7.5 Update package.json scripts
- Remove `--allow-incompatible-update` from the start script if no longer needed
- Ensure `"start": "meteor"` works cleanly

### 7.6 Update UPGRADE_PLAN.md
- Check off all completed phases
- Add a "Remaining Technical Debt" section listing:
  - Components still using `withTracker` (list them)
  - Files still using `Session` (list them)
  - Class components that could be converted to function components

## Guards:

1. Run `npm run lint` — should pass with ZERO errors
2. Run `meteor run` — should start cleanly
3. Run `meteor build --directory /tmp/sparked-build --server-only` — production build should succeed
4. If Docker available: `docker-compose build && docker-compose up` — full stack should work
5. Final check — grep for anything that shouldn't be there:
   - `grep -r "FlowRouter" imports/ client/ server/` → NOTHING
   - `grep -r "require('fibers')" imports/ server/` → NOTHING
   - `grep -r "Fiber(" imports/ server/` → NOTHING
   - `grep -r "meteorhacks:" .meteor/packages` → NOTHING
   - `grep -r "kadira:" .meteor/packages` → NOTHING
   - `grep -r "babel-runtime" package.json` → NOTHING (only @babel/runtime)
   - `grep -r "ReactDOM.render" client/ imports/` → NOTHING

Commit with a descriptive message. Do NOT push to remote.

After this phase, the upgrade is complete. Create a final summary commit or PR.
```

---

## Risk Summary

| Risk | Phase | Mitigation |
|------|-------|------------|
| FlowRouter removal breaks navigation | 3 | Map every route 1:1 against Route Map above, test each |
| Async migration misses a sync call | 4 | Grep guards catch remaining sync ops |
| `ostrio:files` v3 breaks file upload | 5 | Test upload/download with various file types |
| `gridfs-stream` replacement breaks file serving | 5 | Test PDF, video, image serving |
| `alanning:roles` v4 async breaks auth | 5 | Test admin/content-manager role checks |
| React 18 breaks third-party components | 6 | Check each package's React 18 compat before upgrading |
