import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ALL_MODULES_ON,
  NAV_SECTIONS,
  chooserSections,
  enabledList,
  isPathTurnedOff,
  modulesUpdate,
  needsModuleChooser,
  moduleForPath,
  resolveModules,
  visibleSections,
} from "@/lib/modules"

const hrefs = (sections: { items: { href: string }[] }[]) =>
  sections.flatMap((section) => section.items.map((item) => item.href))

describe("module defaulting", () => {
  it("treats a workspace that never chose as everything on", () => {
    assert.deepEqual(resolveModules(undefined), ALL_MODULES_ON)
    assert.deepEqual(resolveModules(null), ALL_MODULES_ON)
  })

  it("treats an empty or unknown-only list as everything on", () => {
    assert.deepEqual(resolveModules([]), ALL_MODULES_ON)
    assert.deepEqual(resolveModules(["billing", 7]), ALL_MODULES_ON)
  })

  it("turns on exactly the stored sections", () => {
    assert.deepEqual(resolveModules(["sales_stock", "reports"]), {
      workspace: false,
      operations: false,
      sales_stock: true,
      reports: true,
    })
  })

  it("ignores unknown keys mixed with known ones", () => {
    assert.deepEqual(resolveModules(["operations", "nope"]), {
      workspace: false,
      operations: true,
      sales_stock: false,
      reports: false,
    })
  })

  it("stores in canonical order", () => {
    assert.deepEqual(
      enabledList(resolveModules(["reports", "workspace"])),
      ["workspace", "reports"]
    )
  })
})

describe("routes to sections", () => {
  it("maps pages and their sub-pages", () => {
    assert.equal(moduleForPath("/dashboard/projects/abc"), "workspace")
    assert.equal(moduleForPath("/dashboard/maintenance"), "operations")
    assert.equal(moduleForPath("/dashboard/sales/123"), "sales_stock")
    assert.equal(moduleForPath("/dashboard/customers/9"), "sales_stock")
    assert.equal(moduleForPath("/dashboard/reports/cash-flow"), "reports")
  })

  it("leaves always-available and unlisted pages alone", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/notifications",
      "/dashboard/settings",
      "/dashboard/site",
      "/dashboard/check-in",
      "/dashboard/profile",
    ]) {
      assert.equal(moduleForPath(path), null, path)
    }
  })

  it("does not match a page that merely shares a prefix", () => {
    assert.equal(moduleForPath("/dashboard/salesforce"), null)
  })

  it("shows the turned-off screen only for a section that is off", () => {
    const salesOnly = resolveModules(["sales_stock"])
    assert.equal(isPathTurnedOff("/dashboard/tickets", salesOnly), true)
    assert.equal(isPathTurnedOff("/dashboard/inventory", salesOnly), false)
    assert.equal(isPathTurnedOff("/dashboard", salesOnly), false)
    assert.equal(isPathTurnedOff("/dashboard/tickets", ALL_MODULES_ON), false)
  })

  it("keeps People reachable for invites when Workspace is off", () => {
    const off = resolveModules(["operations"])
    assert.equal(isPathTurnedOff("/dashboard/people", off), false)
    assert.equal(isPathTurnedOff("/dashboard/approvals", off), true)
  })
})

describe("sidebar filtering", () => {
  it("shows today's sidebar for an owner with everything on", () => {
    const sections = visibleSections(NAV_SECTIONS, { role: "owner", modules: ALL_MODULES_ON })
    assert.deepEqual(
      sections.map((section) => section.label),
      ["Workspace", "Operations", "Sales & stock", "Reports & analytics", "Account"]
    )
    assert.equal(hrefs(sections).length, 24)
  })

  it("never shows owner-only links to a supervisor, whatever is on", () => {
    const links = hrefs(visibleSections(NAV_SECTIONS, { role: "supervisor", modules: ALL_MODULES_ON }))
    assert.ok(!links.includes("/dashboard/expenses"))
    assert.ok(!links.includes("/dashboard/payments"))
    assert.ok(!links.includes("/dashboard/reports/finance"))
    assert.ok(links.includes("/dashboard/inventory"))
  })

  it("drops a switched-off section with its heading", () => {
    const sections = visibleSections(NAV_SECTIONS, {
      role: "owner",
      modules: resolveModules(["workspace", "reports"]),
    })
    assert.deepEqual(
      sections.map((section) => section.label),
      ["Workspace", "Reports & analytics", "Account"]
    )
    assert.ok(!hrefs(sections).includes("/dashboard/inventory"))
  })

  it("keeps Dashboard, without a heading, when Workspace is off", () => {
    const sections = visibleSections(NAV_SECTIONS, {
      role: "owner",
      modules: resolveModules(["sales_stock"]),
    })
    assert.equal(sections[0].label, null)
    assert.deepEqual(hrefs([sections[0]]), ["/dashboard"])
    assert.deepEqual(
      sections.map((section) => section.label),
      [null, "Sales & stock", "Account"]
    )
  })

  it("always keeps Notifications and Organization settings", () => {
    const links = hrefs(visibleSections(NAV_SECTIONS, { role: "supervisor", modules: resolveModules(["reports"]) }))
    assert.ok(links.includes("/dashboard/notifications"))
    assert.ok(links.includes("/dashboard/settings"))
  })

  it("lists each role's own pages on the chooser cards", () => {
    const owner = chooserSections("owner").find((section) => section.module === "sales_stock")
    const supervisor = chooserSections("supervisor").find((section) => section.module === "sales_stock")
    assert.ok(owner?.pages.includes("Payments"))
    assert.ok(!supervisor?.pages.includes("Payments"))
    assert.ok(!chooserSections("owner")[0].pages.includes("Dashboard"))
  })
})

describe("first-visit chooser (Part 1 regression)", () => {
  it("the save always stamps modulesConfiguredAt — 'Use everything' included", () => {
    const now = new Date("2026-10-11T08:00:00Z")
    const everything = modulesUpdate(["workspace", "operations", "sales_stock", "reports"], now)
    assert.equal(everything.$set.modulesConfiguredAt, now)
    assert.deepEqual(everything.$set.enabledModules, ["workspace", "operations", "sales_stock", "reports"])
    const custom = modulesUpdate(["reports", "sales_stock"], now)
    assert.equal(custom.$set.modulesConfiguredAt, now)
    assert.deepEqual(custom.$set.enabledModules, ["sales_stock", "reports"])
  })

  it("the gate asks the owner and a super admin, never a supervisor", () => {
    assert.equal(needsModuleChooser({ modulesConfiguredAt: null, role: "owner", superAdmin: false }), true)
    assert.equal(needsModuleChooser({ modulesConfiguredAt: undefined, role: "supervisor", superAdmin: true }), true)
    assert.equal(needsModuleChooser({ modulesConfiguredAt: null, role: "supervisor", superAdmin: false }), false)
  })

  it("the gate flips once a save has stamped the workspace", () => {
    const business: { modulesConfiguredAt: Date | null } = { modulesConfiguredAt: null }
    assert.equal(needsModuleChooser({ ...business, role: "owner", superAdmin: false }), true)
    Object.assign(business, modulesUpdate(["workspace"], new Date()).$set)
    assert.equal(needsModuleChooser({ ...business, role: "owner", superAdmin: false }), false)
  })
})
