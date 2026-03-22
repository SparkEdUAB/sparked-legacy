# SparkEd: Meteor Upgrade Plan (2.13 → 3.x)

## Context

SparkEd is a legacy Meteor 2.13 educational platform with React 17, FlowRouter, and several deprecated Atmosphere packages. The goal is to upgrade to the latest Meteor 3.x (which removes Fibers entirely, requires Node 20+, and uses async/await throughout) while keeping the app functional at each step.

**Strategy:** Incremental upgrade — Meteor 2.13 → 2.16 → 3.x. Meteor 2.16 supports both Fibers AND async APIs, so we can migrate code gradually before the final jump to 3.x.

---

## Phase 0: Preparation

**Goal:** Set up a safe working environment and update CI.

- [ ] Create a long-lived branch `upgrade/meteor-3` from `master`
- [ ] Update CI (`.github/workflows/main.yml`):
  - Node matrix: `['14', '18']` (replace 10/12)
  - Update `actions/checkout@v1` → `v4`, `actions/setup-node@v1` → `v4`
- [ ] Remove dead CI config — `.travis.yml` references Node 8.11.4 and is unused
- [ ] Remove legacy `babel-runtime@^6.26.0` from `package.json` (already have `@babel/runtime@^7`)

**Verify:** `meteor run` starts, `npm run lint` passes, CI passes on Node 14/18.

---

## Phase 1: Upgrade to Meteor 2.16

**Goal:** Get onto the latest Meteor 2.x which provides async-compatible APIs alongside sync ones.

- [ ] Change `.meteor/release` from `METEOR@2.13` to `METEOR@2.16`
- [ ] Run `meteor update` to resolve package constraints
- [ ] Verify all core packages updated (ecmascript, mongo, accounts-password, etc.)

**Verify:** App starts, all major routes work, file upload works.

---

## Phase 2: Replace Deprecated Non-Router Packages

**Goal:** Remove dead Atmosphere packages before tackling the router and async migration.

- [ ] Replace `http` with `fetch` — Files: `imports/api/sync/syncFile.js`, `imports/api/sync/methods.js` → Use Meteor `fetch` package or native `fetch`
- [ ] Replace `meteorhacks:picker` with `WebApp.connectHandlers` — File: `imports/api/sync/syncFile.js` (4 Picker routes) → `WebApp.connectHandlers.use()` (already partially used in same file)
- [ ] Replace `percolate:synced-cron` — File: `imports/api/crons.js` → npm `node-cron`
- [ ] Replace `momentjs:moment` (Atmosphere) — Files using `moment()` → npm `dayjs` (near-identical API)
- [ ] Replace `fortawesome:fontawesome@4.7.0` — CSS/icon usage → npm `@fortawesome/fontawesome-free` or `font-awesome@4.7.0`
- [ ] Remove `underscore` — Files using `_.` → Use lodash (already a dep) or native JS
- [ ] Remove `jquery` — `.meteor/packages` → Not needed with React
- [ ] Replace `lfergon:exportcsv` — File: `imports/api/statistics/csvMethods.js` → npm `papaparse`
- [ ] Remove `meteortoys:allthings` — `.meteor/packages` → Dev tool, not needed in production
- [ ] Upgrade `aldeed:collection2-core` → `aldeed:collection2` — All 16 collection files with `attachSchema` → `aldeed:collection2@4.0.0+` (Meteor 3 compatible)

**Verify:** App starts without removed-package errors. Sync, CSV export, cron, icons, dates all work.

---

## Phase 3: Router Migration (FlowRouter → React Router)

**Goal:** Replace the unmaintained `kadira:flow-router` with `react-router-dom@^6`.

This is the **largest single change** — 30+ routes in `client/routes.js` and ~50+ component files reference FlowRouter APIs.

- [ ] Install `react-router-dom@^6`
- [ ] Create `client/AppRouter.jsx` with `<BrowserRouter>` + `<Routes>`
- [ ] Create auth guard components (`RequireAuth`, `RequireAdmin`) replicating FlowRouter `triggersEnter` logic
- [ ] Create a `withRouter` HOC for class components that need `useParams`/`useNavigate`:
  ```jsx
  function withRouter(Component) {
    return (props) => {
      const params = useParams();
      const navigate = useNavigate();
      return <Component {...props} params={params} navigate={navigate} />;
    };
  }
  ```
- [ ] Replace all FlowRouter API calls across ~50 component files:
  - `FlowRouter.getParam('_id')` → `useParams()` or `this.props.params._id`
  - `FlowRouter.go('/path')` → `navigate('/path')`
  - `FlowRouter.getQueryParam('q')` → `useSearchParams()`
- [ ] Update `client/main.js` — remove FlowRouter initialization block, render `<AppRouter />` instead
- [ ] Remove `kadira:flow-router`, `kadira:blaze-layout` from `.meteor/packages`
- [ ] Remove `@olivierjm/react-mounter` from `package.json`

**Key files to modify:**
- `client/routes.js` → rewrite as `client/AppRouter.jsx`
- `client/main.js` → new entry point
- `imports/ui/containers/FileUploadComponent.jsx` (6 FlowRouter usages)
- `imports/ui/components/Dashboard/ManageUnits.jsx` (5 usages)
- `imports/ui/components/layouts/Header.jsx` (6 usages)
- ~40 more component files

**Verify:** Every route accessible, auth guards work, URL params work, browser back/forward works, 404 page shows.

---

## Phase 4: Fiber Removal & Async Migration

**Goal:** Convert all synchronous Fiber-dependent code to async/await, preparing for Meteor 3.x.

### 4.1 Remove explicit Fiber usage
- [ ] `imports/api/sync/syncFile.js` line 21: `Fiber = require('fibers')` — remove
- [ ] Lines 357-360, 668-674: `Fiber(function() { ... }).run()` → use `async/await`

### 4.2 Convert all Meteor methods to async (18 method files)
- [ ] Convert each `Meteor.methods({})` handler to `async` functions

```javascript
// BEFORE:
Meteor.methods({
  myMethod(arg) {
    const doc = Collection.findOne({ _id: arg });
    return Collection.update(arg, { $set: { ... } });
  }
});

// AFTER:
Meteor.methods({
  async myMethod(arg) {
    const doc = await Collection.findOneAsync({ _id: arg });
    return await Collection.updateAsync(arg, { $set: { ... } });
  }
});
```

### 4.3 Convert collection operations to async variants
- [ ] All server-side `findOne()` → `findOneAsync()`, `insert()` → `insertAsync()`, `update()` → `updateAsync()`, `remove()` → `removeAsync()`

These async variants exist in Meteor 2.16 alongside the sync ones.

### 4.4 Convert `WebApp.connectHandlers` routes to async
- [ ] Routes in `syncFile.js` that call `Meteor.call()` synchronously → `await Meteor.callAsync()`

**Heaviest file:** `imports/api/sync/syncFile.js` (709 lines, 21 methods, all Fiber usage)

**Method files to convert:**
- `imports/api/sync/syncFile.js` (21 methods)
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

**Verify:** All sync operations work, file upload/download works, no `fibers` references remain in codebase.

---

## Phase 5: Upgrade to Meteor 3.x

**Goal:** The actual major version jump, which should work cleanly if Phase 4 was done right.

- [ ] Change `.meteor/release` to `METEOR@3.1` (or latest stable)
- [ ] Run `meteor update --release 3.1`
- [ ] Update Atmosphere packages for Meteor 3 compatibility:
  - `alanning:roles` → `4.0.0` (async API: `Roles.userIsInRoleAsync()`)
  - `ostrio:files` → `3.0.0+` (async callbacks)
  - `react-meteor-data` → `2.7+` (async `useTracker`)
  - `aldeed:collection2` → `4.0.0+`
- [ ] Replace `gridfs-stream` (deprecated) with MongoDB native `GridFSBucket` in `imports/api/resources/resources.js`
- [ ] Remove `es5-shim`, `session` (if Session usage replaced), `blaze` transitives
- [ ] Update Docker:
  - `Dockerfile`: `node:14-alpine` → `node:20-alpine`
  - `docker-compose.yml`: `mongo:4.4` → `mongo:7.0`
- [ ] Update CI node matrix to `['20']`

**Verify:** `meteor run` on 3.x without errors, all features work, Docker build succeeds, `docker-compose up` runs full stack.

---

## Phase 6: React 17 → 18 + Modernization

**Goal:** Upgrade React and modernize component patterns.

- [ ] Update `package.json`: `react@^18.2.0`, `react-dom@^18.2.0`
- [ ] Change `ReactDOM.render()` → `createRoot()` API in entry point
- [ ] Verify third-party React packages (`react-player`, `react-color`, `react-paginate`, `react-countup`) work with React 18
- [ ] **Gradually** convert `withTracker` HOC → `useTracker` hook (40+ components, can be done incrementally — `withTracker` still works)
- [ ] Replace `Session.get/set` (138 occurrences across 24 files) with React Context + `useState`

**Verify:** No console errors, all components render, interactive features (forms, modals, pagination) work.

---

## Phase 7: Build Tooling Cleanup

- [ ] Upgrade ESLint 7 → 9, replace `babel-eslint` with `@babel/eslint-parser`
- [ ] Remove dead FlowRouter/Picker globals from `.eslintrc.yml`
- [ ] Delete dead `imports/api/sync/endpoint.js` (commented-out Restivus import)
- [ ] Update Dockerfile for Meteor 3 build process
- [ ] Update `.gitpod.Dockerfile` and `.gitpod.yml` for Meteor 3

**Verify:** `npm run lint` passes, Docker build succeeds, CI green.

---

## Risk Summary

| Risk | Phase | Mitigation |
|------|-------|------------|
| FlowRouter removal breaks navigation | 3 | Map every route 1:1, test each one |
| Async migration misses a sync call | 4 | Grep for all `findOne(`, `insert(`, `update(`, `remove(` without `Async` |
| `ostrio:files` v3 breaks file upload | 5 | Test upload/download with various file types |
| `gridfs-stream` replacement breaks file serving | 5 | Test PDF, video, image serving |
| `alanning:roles` v4 async breaks auth | 5 | Test admin/content-manager role checks |
| React 18 breaks third-party components | 6 | Check each package's React 18 support before upgrading |

---

## Verification Checklist (run after each phase)

- [ ] `meteor run` starts without errors
- [ ] Login/logout works
- [ ] Navigate to: `/`, `/login`, `/register`, `/dashboard/overview`, `/dashboard/accounts`, `/contents/:id`, `/view_resource/:id`
- [ ] File upload works
- [ ] Admin-only routes are protected
- [ ] `npm run lint` passes
- [ ] `docker-compose up` works (from Phase 5 onward)

---

## References

- [Meteor 3.0 Migration Guide](https://v3-migration-docs.meteor.com/)
- [Breaking Changes](https://v3-migration-docs.meteor.com/breaking-changes/)
- [Upgrading Packages](https://v3-migration-docs.meteor.com/breaking-changes/upgrading-packages)
- [Gradual Upgrade Guide](https://dev.to/meteor/gradually-upgrading-a-meteorjs-project-to-30-5aj0)
