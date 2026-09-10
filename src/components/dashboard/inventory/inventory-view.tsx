"use client"

import * as React from "react"
import { cn } from "cn"

import {
  DeleteCategoryDialog,
  DeleteItemDialog,
} from "@/components/dashboard/inventory/delete-dialogs"
import { CategoryDialog } from "@/components/dashboard/inventory/category-dialog"
import { ItemDialog } from "@/components/dashboard/inventory/item-dialog"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import { Pagination, paginate } from "@/components/dashboard/pagination"
import { RowsSkeleton, StatGridSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  Panel,
  StatCard,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import {
  useInventoryCategories,
  useInventoryItems,
  type CategoryWithCount,
} from "@/lib/queries"
import type { ItemDTO } from "@/models/inventory-item"

type Tab = "items" | "categories"

const PER_PAGE = 10

/**
 * Stock the workspace holds: the categories it is filed under, and the items
 * themselves with what they cost and how many are left. Owners and
 * supervisors only — the crew never sees this page.
 */
export function InventoryView() {
  const [tab, setTab] = React.useState<Tab>("items")
  const [search, setSearch] = React.useState("")
  const [categoryId, setCategoryId] = React.useState("all")
  const [page, setPage] = React.useState(1)

  const [itemOpen, setItemOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<ItemDTO | null>(null)
  const [deletingItem, setDeletingItem] = React.useState<ItemDTO | null>(null)

  const [categoryOpen, setCategoryOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] =
    React.useState<CategoryWithCount | null>(null)
  const [deletingCategory, setDeletingCategory] =
    React.useState<CategoryWithCount | null>(null)

  // Every filter puts you back on the first page: page 4 of a list that just
  // became one page long is nothing at all.
  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  const itemsQuery = useInventoryItems()
  const categoriesQuery = useInventoryCategories()

  const items = itemsQuery.data?.items ?? []
  const categories = categoriesQuery.data?.categories ?? []
  const loading = itemsQuery.isPending || categoriesQuery.isPending

  const needle = search.trim().toLowerCase()
  const visible = items.filter((item) => {
    if (categoryId !== "all" && item.category?.id !== categoryId) return false
    if (!needle) return true
    return [item.name, item.sku, item.category?.name, item.location].some(
      (field) => field?.toLowerCase().includes(needle)
    )
  })

  const low = items.filter(runningOut)
  const value = items.reduce((sum, item) => sum + item.price * item.stock, 0)

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Workspace"
        title="Inventory"
        subtitle="What you hold, what it costs, and what is running out."
        actions={
          <>
            <button
              type="button"
              onClick={() => setCategoryOpen(true)}
              className={secondaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              New category
            </button>
            <button
              type="button"
              onClick={() => setItemOpen(true)}
              className={primaryButtonClass}
            >
              <PlusIcon className="size-3.5" />
              New item
            </button>
          </>
        }
      />

      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="ITEMS" value={items.length} />
          <StatCard label="CATEGORIES" value={categories.length} />
          <StatCard
            label="RUNNING OUT"
            value={low.length}
            accent={low.length > 0}
            hint={low.length > 0 ? "At or below the low-stock mark" : undefined}
          />
          <StatCard label="STOCK VALUE" value={amount(value)} />
        </div>
      )}

      <div className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
        {(["items", "categories"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTab(option)}
            aria-pressed={tab === option}
            className={cn(
              "rounded-[5px] px-3 py-1.5 text-[12.5px] capitalize transition-colors",
              tab === option
                ? "bg-p-100 text-p-700 font-semibold"
                : "text-n-600 hover:bg-n-100 font-medium"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {loading ? (
        <RowsSkeleton rows={4} />
      ) : itemsQuery.isError || categoriesQuery.isError ? (
        <EmptyState
          message="Couldn't load the inventory. Your connection may have dropped."
          action={
            <button
              type="button"
              onClick={() => {
                void itemsQuery.refetch()
                void categoriesQuery.refetch()
              }}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      ) : tab === "items" ? (
        <ItemsPanel
          items={visible}
          total={items.length}
          categories={categories}
          categoryId={categoryId}
          onCategory={change(setCategoryId)}
          page={page}
          onPage={setPage}
          search={search}
          onSearch={change(setSearch)}
          onNew={() => setItemOpen(true)}
          onEdit={setEditingItem}
          onDelete={setDeletingItem}
        />
      ) : (
        <CategoriesPanel
          categories={categories}
          onNew={() => setCategoryOpen(true)}
          onEdit={setEditingCategory}
          onDelete={setDeletingCategory}
          onShowItems={(id) => {
            setCategoryId(id)
            setTab("items")
          }}
        />
      )}

      <ItemDialog open={itemOpen} onClose={() => setItemOpen(false)} />
      <CategoryDialog
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
      />

      {/* Keyed on the row, so editing a second one starts from its own values. */}
      {editingItem ? (
        <ItemDialog
          key={editingItem.id}
          open
          item={editingItem}
          onClose={() => setEditingItem(null)}
        />
      ) : null}
      {deletingItem ? (
        <DeleteItemDialog
          key={deletingItem.id}
          open
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
        />
      ) : null}
      {editingCategory ? (
        <CategoryDialog
          key={editingCategory.id}
          open
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
        />
      ) : null}
      {deletingCategory ? (
        <DeleteCategoryDialog
          key={deletingCategory.id}
          open
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
        />
      ) : null}
    </DashboardMain>
  )
}

function ItemsPanel({
  items,
  total,
  categories,
  categoryId,
  onCategory,
  page,
  onPage,
  search,
  onSearch,
  onNew,
  onEdit,
  onDelete,
}: {
  items: ItemDTO[]
  total: number
  categories: CategoryWithCount[]
  categoryId: string
  onCategory: (id: string) => void
  page: number
  onPage: (next: number) => void
  search: string
  onSearch: (value: string) => void
  onNew: () => void
  onEdit: (item: ItemDTO) => void
  onDelete: (item: ItemDTO) => void
}) {
  const shown = paginate(items, page, PER_PAGE)

  if (total === 0) {
    return (
      <EmptyState
        message={
          categories.length === 0
            ? "Nothing in stock yet. Add a category first — cables, tools, safety gear — then the items that sit in it."
            : "No items yet. Add the first one and its stock count shows up here."
        }
        action={
          <button type="button" onClick={onNew} className={primaryButtonClass}>
            New item
          </button>
        }
      />
    )
  }

  return (
    <Panel className="overflow-hidden">
      <div className="border-n-200 flex flex-wrap items-center justify-between gap-4 border-b px-[18px] py-3.5">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="All"
            active={categoryId === "all"}
            onClick={() => onCategory("all")}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onClick={() => onCategory(category.id)}
            />
          ))}
        </div>

        <label className="border-n-200 bg-n-50 flex min-w-[210px] items-center gap-2 rounded-md border px-2.5 py-2">
          <SearchIcon />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search items"
            className="text-n-900 placeholder:text-n-400 w-full border-none bg-transparent text-[13.5px] outline-none"
          />
        </label>
      </div>

      <div className="border-n-200 bg-n-100 hidden grid-cols-[1.7fr_140px_110px_130px_130px] gap-3.5 border-b px-[18px] py-2.5 lg:grid">
        {["ITEM", "CATEGORY", "PRICE", "IN STOCK", ""].map((head) => (
          <span
            key={head}
            className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]"
          >
            {head}
          </span>
        ))}
      </div>

      {shown.rows.map((item) => (
        <div
          key={item.id}
          className="border-n-200/70 hover:bg-n-50 grid gap-3.5 border-b px-[18px] py-3.5 lg:grid-cols-[1.7fr_140px_110px_130px_130px] lg:items-center"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">{item.name}</span>
            <span className="text-n-500 truncate text-xs">
              {[item.sku, item.location].filter(Boolean).join(" · ") ||
                item.description ||
                "—"}
            </span>
          </div>

          <span className="text-n-700 truncate text-[12.5px]">
            {item.category?.name ?? "—"}
          </span>

          <span className="text-n-700 font-mono text-[12.5px]">
            {amount(item.price)}
          </span>

          <span className="flex items-center gap-2">
            <span className="font-mono text-[12.5px] font-semibold">
              {amount(item.stock)}{" "}
              <span className="text-n-500 font-normal">{item.unit}</span>
            </span>
            <StockChip item={item} />
          </span>

          <div className="flex gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="border-n-300 text-s-overdue rounded-md border bg-white px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-[#fdecec]"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {items.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-n-500 m-0 text-sm">
            Nothing matches that. Clear the search or pick another category.
          </p>
        </div>
      ) : null}

      <Pagination
        page={shown.page}
        pageCount={shown.pageCount}
        from={shown.from}
        to={shown.to}
        total={items.length}
        noun="items"
        onPage={onPage}
      />
    </Panel>
  )
}

function CategoriesPanel({
  categories,
  onNew,
  onEdit,
  onDelete,
  onShowItems,
}: {
  categories: CategoryWithCount[]
  onNew: () => void
  onEdit: (category: CategoryWithCount) => void
  onDelete: (category: CategoryWithCount) => void
  onShowItems: (id: string) => void
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        message="No categories yet. They are how the item list stays readable once there is more than a shelf of it."
        action={
          <button type="button" onClick={onNew} className={primaryButtonClass}>
            New category
          </button>
        }
      />
    )
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <Panel key={category.id} className="flex flex-col gap-3 p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <span className="font-heading min-w-0 truncate text-[16px] font-semibold">
              {category.name}
            </span>
            <button
              type="button"
              onClick={() => onShowItems(category.id)}
              className="border-p-200 bg-p-100 text-p-700 shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-medium"
            >
              {category.items} item{category.items === 1 ? "" : "s"}
            </button>
          </div>

          {category.description ? (
            <p className="text-n-600 m-0 line-clamp-2 text-[13px] leading-relaxed">
              {category.description}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEdit(category)}
              className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border bg-white px-3 py-2 text-[12.5px] font-semibold"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(category)}
              className="border-n-300 text-s-overdue rounded-md border bg-white px-3 py-2 text-[12.5px] font-semibold hover:bg-[#fdecec]"
            >
              Delete
            </button>
          </div>
        </Panel>
      ))}
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
        active
          ? "bg-p-100 border-p-400 text-p-700 font-semibold"
          : "border-n-200 text-n-600 hover:bg-n-100 bg-white font-medium"
      )}
    >
      {label}
    </button>
  )
}

function StockChip({ item }: { item: ItemDTO }) {
  if (item.stock === 0) {
    return (
      <span className="text-s-overdue border-s-overdue/40 rounded-full border px-1.5 font-mono text-[10px] tracking-[0.05em]">
        OUT
      </span>
    )
  }

  if (!runningOut(item)) return null

  return (
    <span className="text-a-700 border-a-400 bg-a-50 rounded-full border px-1.5 font-mono text-[10px] tracking-[0.05em]">
      LOW
    </span>
  )
}

/** At or below the mark the owner set — zero included, whatever the mark is. */
function runningOut(item: ItemDTO) {
  return item.stock <= item.lowStockAt
}

/**
 * Prices and counts share one format. There is no currency on the workspace,
 * so this stays a plain number — the same way advance requests are shown.
 */
function amount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-n-400 size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  )
}
