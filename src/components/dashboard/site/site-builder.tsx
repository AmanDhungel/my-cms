"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { InlineEditor, slotLabel } from "@/components/dashboard/site/inline-editor"
import { TemplateGallery } from "@/components/dashboard/site/template-gallery"
import { RowsSkeleton } from "@/components/dashboard/skeletons"
import {
  DashboardMain,
  EmptyState,
  PageHeading,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/ui"
import { SiteRenderer } from "@/components/sites/site-renderer"
import { ApiRequestError } from "@/lib/api-client"
import {
  reportMutationError,
  usePublishSite,
  useSaveSite,
  useSite,
} from "@/lib/queries"
import { SECTION_LABELS, sectionsOf, templateById, type SectionKey } from "@/lib/site-templates"
import { siteUrlFor } from "@/lib/tenancy"
import { useRevokeOnUnmount, useUnsavedGuard } from "@/lib/use-unsaved-guard"
import { siteSchema } from "@/lib/validations/site"
import {
  checkableContent,
  commitDraft,
  draftFingerprint,
  draftPreviews,
  previewContent,
  toDraft,
  type SiteDraft,
} from "@/components/dashboard/site/site-draft"
import {
  initialLayout,
  layoutFits,
  pruneWithLayout,
  type SampleLayout,
} from "@/components/dashboard/site/sample-rows"
import type { SiteDTO } from "@/models/site"

type Tab = "template" | "content" | "preview"

/**
 * Building the public website.
 *
 * Three steps in the order they are actually done: pick the shape, fill in
 * what it asks for, look at it, publish. Filling in happens on the page
 * itself — the real renderer, editable in place — and the preview is that
 * same renderer with the editing taken away, so what is on screen here is
 * exactly what the subdomain serves.
 */
export function SiteBuilder({ port }: { port: string | null }) {
  const query = useSite()

  if (query.isPending) {
    return (
      <DashboardMain className="gap-5">
        <PageHeading eyebrow="Account" title="Your website" />
        <RowsSkeleton rows={5} />
      </DashboardMain>
    )
  }

  if (query.isError || !query.data) {
    return (
      <DashboardMain className="gap-5">
        <PageHeading eyebrow="Account" title="Your website" />
        <EmptyState
          message="Couldn't load your website. Your connection may have dropped."
          action={
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={primaryButtonClass}
            >
              Try again
            </button>
          }
        />
      </DashboardMain>
    )
  }

  return (
    <EditorHost
      latest={query.data.site}
      uploads={query.data.uploads}
      port={port}
      refetch={async () => (await query.refetch()).data?.site ?? null}
    />
  )
}

/**
 * Which version of the site the editor is working from, and what to do when
 * the stored site moves on without it.
 *
 * The editor works from a snapshot (`shown`), keyed on its updatedAt. When
 * a newer version arrives — a save or publish from another tab, noticed
 * when this tab regains focus — it replaces the snapshot quietly if there is
 * nothing unsaved here, as before. If there is, nothing is dropped: a banner
 * offers to reload (discarding this tab's changes) or keep editing. Keeping
 * editing adopts the newer version as the one this tab's next save is based
 * on — this tab's save then wins. A save based on an out-of-date version
 * that slipped through is refused by the API with 409 and shows the same
 * banner.
 */
function EditorHost({
  latest,
  uploads,
  port,
  refetch,
}: {
  latest: SiteDTO
  uploads: boolean
  port: string | null
  refetch: () => Promise<SiteDTO | null>
}) {
  const [shown, setShown] = React.useState(latest)
  // The sample-row layout, carried over the remount that follows this tab's
  // own save so untouched samples outlive it.
  const [carry, setCarry] = React.useState<SampleLayout | null>(null)
  const [dirty, setDirty] = React.useState(false)
  // The newer version the owner chose to keep editing over.
  const [acknowledged, setAcknowledged] = React.useState<string | null>(null)
  // The current version, as reported by a 409 before a refetch catches up.
  const [staleAt, setStaleAt] = React.useState<string | null>(null)

  // Newer in time, not just different: straight after this tab's own save
  // the query still holds the version from before it, which must not win.
  const newer = Date.parse(latest.updatedAt) > Date.parse(shown.updatedAt)
  // Nothing unsaved here: take the newer version quietly, as before.
  if (newer && !dirty && staleAt === null) {
    setShown(latest)
    setCarry(null)
    setAcknowledged(null)
  }

  const current = staleAt ?? latest.updatedAt
  const conflict =
    dirty && (staleAt !== null || newer) && acknowledged !== current

  function adopt(site: SiteDTO, layout: SampleLayout | null) {
    setShown(site)
    setCarry(layout)
    setAcknowledged(null)
    setStaleAt(null)
    setDirty(false)
  }

  return (
    <Editor
      key={shown.updatedAt}
      saved={shown}
      uploads={uploads}
      port={port}
      initialLayout={carry}
      baseVersion={acknowledged ?? shown.updatedAt}
      conflict={conflict}
      onDirty={setDirty}
      onSaved={(site, layout) => adopt(site, layout)}
      onStale={(updatedAt) => {
        setStaleAt(updatedAt ?? latest.updatedAt)
        void refetch()
      }}
      onReload={async () => adopt((await refetch()) ?? latest, null)}
      onKeepEditing={() => {
        setAcknowledged(current)
        setStaleAt(null)
      }}
    />
  )
}

/** A stable string for a record, whatever order its keys were added in. */
function printExtras(extras: Record<string, string>) {
  return JSON.stringify(Object.entries(extras).sort(([a], [b]) => a.localeCompare(b)))
}

/** "content.products.0.name" → "What you sell · product 1 name". */
function describeIssue(path: string) {
  const [root, ...rest] = path.split(".")
  const id = rest.join(".")
  if (root === "extraSlots") return slotLabel(id)
  if (root !== "content") return path
  const section = rest[0] as SectionKey
  const label = slotLabel(id)
  return SECTION_LABELS[section] ? `${SECTION_LABELS[section]} · ${label}` : label
}

function Editor({
  saved,
  uploads,
  port,
  initialLayout: carried,
  baseVersion,
  conflict,
  onDirty,
  onSaved,
  onStale,
  onReload,
  onKeepEditing,
}: {
  saved: SiteDTO
  uploads: boolean
  port: string | null
  /** A sample-row layout carried over from before a save, if it still fits. */
  initialLayout: SampleLayout | null
  /** The version this editor's next save is based on. */
  baseVersion: string
  /** Whether to show the "changed in another tab" banner. */
  conflict: boolean
  onDirty: (dirty: boolean) => void
  onSaved: (site: SiteDTO, layout: SampleLayout) => void
  onStale: (updatedAt: string | null) => void
  onReload: () => Promise<void>
  onKeepEditing: () => void
}) {
  const [tab, setTab] = React.useState<Tab>("content")
  const [slug, setSlug] = React.useState(saved.slug)
  const [template, setTemplate] = React.useState(saved.template)
  const [content, setContent] = React.useState<SiteDraft>(() =>
    toDraft(saved.content)
  )
  const [layout, setLayout] = React.useState<SampleLayout>(() => {
    const draft = toDraft(saved.content)
    return carried && layoutFits(carried, draft) ? carried : initialLayout(draft)
  })
  const savedExtras = React.useMemo(() => saved.extraSlots ?? {}, [saved.extraSlots])
  const [extraSlots, setExtraSlots] =
    React.useState<Record<string, string>>(savedExtras)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const save = useSaveSite()
  const publish = usePublishSite()

  // Compared through the fingerprint, so a picture chosen but not yet
  // uploaded still counts as an unsaved change.
  const savedPrint = React.useMemo(
    () => draftFingerprint(toDraft(saved.content)),
    [saved.content]
  )
  const dirty =
    slug !== saved.slug ||
    template !== saved.template ||
    draftFingerprint(content) !== savedPrint ||
    printExtras(extraSlots) !== printExtras(savedExtras)

  useUnsavedGuard(dirty)
  useRevokeOnUnmount(() => draftPreviews(content))
  React.useEffect(() => onDirty(dirty), [dirty, onDirty])

  const url = siteUrlFor(slug, port)
  const sections = sectionsOf(template)
  const chosen = templateById(template)

  const [uploading, setUploading] = React.useState(false)
  // Pictures still being compressed. Save waits for them: saving before one
  // is ready would store the page without it, and the editor remounting on
  // the save would drop it on the floor.
  const [preparing, setPreparing] = React.useState(0)
  const onPreparing = React.useCallback(
    (delta: 1 | -1) => setPreparing((count) => Math.max(0, count + delta)),
    []
  )

  function removeOrphans(fresh: string[]) {
    if (fresh.length === 0) return
    void fetch("/api/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: fresh }),
    })
  }

  function showIssues(issues: { path: PropertyKey[]; message: string }[]) {
    const next: Record<string, string> = {}
    for (const issue of issues) {
      next[issue.path.map(String).join(".") || "root"] ??= issue.message
    }
    setErrors(next)
    const [path, message] = Object.entries(next)[0] ?? []
    if (path === "slug") {
      toast.error(message ?? "Check the web address")
      return
    }
    if (path) {
      // Say where, because the field may be in a section this template
      // doesn't draw — kept from another template, and not on screen.
      toast.error(`${describeIssue(path)}: ${message}`)
      if (path.startsWith("content") || path.startsWith("extraSlots")) {
        setTab("content")
      }
      return
    }
    toast.error("Some fields need another look")
  }

  /**
   * Save.
   *
   * The words are checked first, so a typo costs no bandwidth. Then pictures
   * are uploaded — here and nowhere else — and only the addresses that come
   * back are sent on to be stored. If anything after the uploads fails, the
   * files this attempt uploaded are deleted again, and the ones from earlier
   * saves are left alone: the stored site still points at them.
   */
  async function submit() {
    if (save.isPending || uploading || preparing > 0) return

    // The empty rows are dropped from what is on screen too, so an error
    // about "service 2" points at the row the owner sees as service 2.
    const pruned = pruneWithLayout(content, layout)
    const draft = pruned.draft
    setContent(draft)
    setLayout(pruned.layout)
    const check = siteSchema.safeParse({
      slug,
      template,
      content: checkableContent(draft),
      extraSlots,
    })
    if (!check.success) {
      showIssues(check.error.issues)
      return
    }

    const fresh: string[] = []
    let ready
    setUploading(true)
    try {
      ready = await commitDraft(draft, fresh)
    } catch (error) {
      setUploading(false)
      removeOrphans(fresh)
      toast.error(
        error instanceof Error ? error.message : "A picture didn't upload"
      )
      return
    }
    setUploading(false)

    const parsed = siteSchema.safeParse({ slug, template, content: ready, extraSlots })
    if (!parsed.success) {
      removeOrphans(fresh)
      showIssues(parsed.error.issues)
      return
    }

    setErrors({})
    save.mutate({ ...parsed.data, updatedAt: baseVersion }, {
      onSuccess: ({ site }) => {
        toast.success("Saved")
        onSaved(site, pruned.layout)
      },
      onError: (error) => {
        removeOrphans(fresh)
        // Saved from an out-of-date version: the banner explains it, and
        // offers the way out — not a generic error.
        if (error instanceof ApiRequestError && error.body?.code === "stale") {
          const at = error.body.updatedAt
          onStale(typeof at === "string" ? at : null)
          return
        }
        // A taken address comes back as a conflict, not a field error, so
        // it is pinned to the address box here.
        if (error instanceof ApiRequestError && error.status === 409) {
          setErrors((prev) => ({ ...prev, slug: error.message }))
        }
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({ ...prev, [path]: message }))
        )
      },
    })
  }

  /** Back to what is saved, letting go of every picture picked since. */
  function discard() {
    for (const preview of draftPreviews(content)) URL.revokeObjectURL(preview)
    setSlug(saved.slug)
    setTemplate(saved.template)
    setContent(toDraft(saved.content))
    setLayout(initialLayout(toDraft(saved.content)))
    setExtraSlots(savedExtras)
    setErrors({})
  }

  function togglePublished() {
    if (publish.isPending) return

    if (dirty) {
      toast.error("Save your changes first, then publish")
      return
    }

    publish.mutate(!saved.published, {
      onSuccess: ({ site }) =>
        toast.success(
          site.published ? `Live at ${siteUrlFor(site.slug, port)}` : "Taken down"
        ),
      onError: (error) => reportMutationError(error),
    })
  }

  const busy = save.isPending || uploading

  return (
    <DashboardMain className="gap-5">
      <PageHeading
        eyebrow="Account"
        title="Your website"
        subtitle="A public page for your business, on its own address. Publishing puts it live straight away — there is nothing to build and nothing to wait for."
        actions={
          <>
            <button
              type="button"
              onClick={togglePublished}
              disabled={publish.isPending}
              className={secondaryButtonClass}
            >
              {publish.isPending
                ? "Working…"
                : saved.published
                  ? "Take it down"
                  : "Publish"}
            </button>
            {dirty ? (
              <button
                type="button"
                onClick={discard}
                disabled={busy}
                className={secondaryButtonClass}
              >
                Discard
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!dirty || busy || preparing > 0}
              className={primaryButtonClass}
            >
              {uploading
                ? "Uploading pictures…"
                : save.isPending
                  ? "Saving…"
                  : preparing > 0
                    ? "Preparing picture…"
                    : "Save changes"}
            </button>
          </>
        }
      />

      {conflict ? (
        <div
          role="alert"
          data-site-conflict
          className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-amber-300 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900"
        >
          <span className="font-semibold">
            This site was changed in another tab.
          </span>
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onReload()}
              className={secondaryButtonClass}
            >
              Reload (discard my changes)
            </button>
            <button
              type="button"
              onClick={onKeepEditing}
              className={primaryButtonClass}
            >
              Keep editing
            </button>
          </span>
        </div>
      ) : null}

      {/*
        Everything editable is frozen while a save is in flight. The editor
        restarts from the stored site once the save lands, so anything typed
        in the meantime would be silently thrown away.
      */}
      <div
        inert={busy || undefined}
        aria-busy={busy || undefined}
        data-site-workspace
        className={cn("flex flex-col gap-5 transition-opacity", busy && "opacity-60")}
      >
        {/* The address, and whether anyone can see it yet. */}
        <div className="border-n-200 flex flex-wrap items-end gap-4 rounded-[14px] border bg-white p-4">
          <label className="flex min-w-[240px] flex-1 flex-col gap-[7px]">
            <FieldLabel>Web address</FieldLabel>
            <div className="flex items-center gap-0">
              <input
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value.toLowerCase().trim())
                  setErrors((prev) => ({ ...prev, slug: "" }))
                }}
                aria-label="Web address"
                aria-invalid={Boolean(errors.slug)}
                className={cn(inputClass, "rounded-r-none text-right font-mono")}
              />
              <span className="border-n-300 bg-n-100 text-n-600 h-[42px] rounded-r-md border border-l-0 px-2.5 font-mono text-[13px] leading-[40px]">
                .{url.split("//")[1]?.split(".").slice(1).join(".") ?? "localhost"}
              </span>
            </div>
            <FieldError message={errors.slug} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-n-500 font-mono text-[10.5px] tracking-[0.07em]">
              STATUS
            </span>
            <span
              className={cn(
                "w-fit rounded-full px-2.5 py-1 text-[12px] font-semibold",
                saved.published
                  ? "bg-s-done/15 text-s-done"
                  : "bg-n-100 text-n-500"
              )}
            >
              {saved.published ? "Live" : "Not published"}
            </span>
          </div>

          {saved.published ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClass}
            >
              Open {url.replace(/^https?:\/\//, "")} ↗
            </a>
          ) : (
            <span className="text-n-500 max-w-[280px] text-[12.5px] leading-snug">
              It will be at{" "}
              <span className="font-mono">{url.replace(/^https?:\/\//, "")}</span>{" "}
              once you publish.
            </span>
          )}
        </div>

        <div className="border-n-200 flex w-fit gap-0.5 rounded-md border bg-white p-0.5">
          {(["template", "content", "preview"] as const).map((option) => (
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

        {tab === "template" ? (
          <TemplateGallery
            value={template}
            onPick={(id) => {
              setTemplate(id)
              // Everything typed so far is kept: the page on the next tab is
              // the same words in the new shape.
              toast.success(`${templateById(id).name} chosen`)
            }}
          />
        ) : tab === "content" ? (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-n-500 m-0 text-[13px] leading-relaxed">
                Using <span className="font-semibold">{chosen.name}</span>, which
                shows {sections.length} sections. Click any words on the page to
                change them, and any picture to add or replace it. Faded words are
                samples: they are never published, and a section left as samples
                is left off the live site.
              </p>
              <div
                data-site-canvas
                className="border-n-200 overflow-hidden rounded-[14px] border bg-white"
              >
                <InlineEditor
                  template={template}
                  draft={content}
                  extraSlots={extraSlots}
                  layout={layout}
                  onDraft={setContent}
                  onExtraSlots={setExtraSlots}
                  onLayout={setLayout}
                  onPreparing={onPreparing}
                  uploads={uploads}
                  errors={errors}
                />
              </div>
            </div>

            <DetailsPanel
              draft={content}
              onDraft={setContent}
              errors={errors}
              uploads={uploads}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-n-500 m-0 text-[13px]">
              Exactly what a visitor gets, with whatever you have typed so far.
              {dirty ? " Unsaved changes are included." : ""}
            </p>
            <div
              data-site-preview
              className="border-n-200 overflow-hidden rounded-[14px] border bg-white"
            >
              <SiteRenderer
                template={template}
                content={previewContent(content)}
                extraSlots={extraSlots}
                mode="preview"
              />
            </div>
          </div>
        )}
      </div>
    </DashboardMain>
  )
}

/**
 * The few things that are not words on the page: where the button goes, a
 * map link, and the name and description that search engines and link
 * previews read. Too fiddly to click on, so they sit beside it.
 */
function DetailsPanel({
  draft,
  onDraft,
  errors,
  uploads,
}: {
  draft: SiteDraft
  onDraft: React.Dispatch<React.SetStateAction<SiteDraft>>
  errors: Record<string, string>
  uploads: boolean
}) {
  const orNull = (value: string) => (value.trim() === "" ? null : value)

  return (
    <aside
      data-site-details
      className="border-n-200 flex flex-col gap-4 rounded-[14px] border bg-white p-4 xl:sticky xl:top-[70px]"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-heading m-0 text-[15px] font-semibold">Details</h2>
        <p className="text-n-500 m-0 text-[12.5px] leading-snug">
          The parts of the site that aren&apos;t words on the page.
        </p>
      </div>

      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Business name</FieldLabel>
        <input
          value={draft.name}
          onChange={(event) => onDraft((prev) => ({ ...prev, name: event.target.value }))}
          aria-label="Business name"
          aria-invalid={Boolean(errors["content.name"])}
          className={inputClass}
        />
        <FieldError message={errors["content.name"]} />
      </label>

      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={draft.description ?? ""}
          onChange={(event) =>
            onDraft((prev) => ({ ...prev, description: orNull(event.target.value) }))
          }
          aria-label="Description"
          aria-invalid={Boolean(errors["content.description"])}
          placeholder="Shown in search results and when the link is shared"
          className={cn(inputClass, "min-h-[84px] resize-y text-[14px]")}
        />
        <FieldError message={errors["content.description"]} />
      </label>

      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Button link</FieldLabel>
        <input
          value={draft.hero.ctaHref ?? ""}
          onChange={(event) =>
            onDraft((prev) => ({
              ...prev,
              hero: { ...prev.hero, ctaHref: orNull(event.target.value) },
            }))
          }
          aria-label="Button link"
          aria-invalid={Boolean(errors["content.hero.ctaHref"])}
          placeholder="Empty rings your phone number"
          className={cn(inputClass, "font-mono text-[13px]")}
        />
        <FieldError message={errors["content.hero.ctaHref"]} />
      </label>

      <label className="flex flex-col gap-[7px]">
        <FieldLabel>Map link</FieldLabel>
        <input
          value={draft.contact.mapUrl ?? ""}
          onChange={(event) =>
            onDraft((prev) => ({
              ...prev,
              contact: { ...prev.contact, mapUrl: orNull(event.target.value) },
            }))
          }
          aria-label="Map link"
          aria-invalid={Boolean(errors["content.contact.mapUrl"])}
          placeholder="A Google Maps link to your address"
          className={cn(inputClass, "font-mono text-[13px]")}
        />
        <FieldError message={errors["content.contact.mapUrl"]} />
      </label>

      {!uploads ? (
        <p className="text-s-overdue m-0 text-[12px] leading-snug">
          File storage isn&apos;t configured on this server, so pictures
          can&apos;t be added.
        </p>
      ) : null}
    </aside>
  )
}
