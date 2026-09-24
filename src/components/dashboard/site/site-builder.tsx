"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { ContentEditor } from "@/components/dashboard/site/content-editor"
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
import {
  reportMutationError,
  usePublishSite,
  useSaveSite,
  useSite,
} from "@/lib/queries"
import { sectionsOf, templateById } from "@/lib/site-templates"
import { siteUrlFor } from "@/lib/tenancy"
import { siteSchema } from "@/lib/validations/site"
import {
  commitDraft,
  draftFingerprint,
  previewContent,
  toDraft,
  type SiteDraft,
} from "@/components/dashboard/site/site-draft"
import type { SiteDTO } from "@/models/site"

type Tab = "template" | "content" | "preview"

/**
 * Building the public website.
 *
 * Three steps in the order they are actually done: pick the shape, fill in
 * what it asks for, look at it, publish. The preview is the real renderer
 * with the real content — not an approximation — so what is on screen here is
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

  // Keyed on the saved version, so a save elsewhere starts the editor from
  // what is actually stored rather than from a stale draft.
  return (
    <Editor
      key={query.data.site.updatedAt}
      saved={query.data.site}
      uploads={query.data.uploads}
      port={port}
    />
  )
}

function Editor({
  saved,
  uploads,
  port,
}: {
  saved: SiteDTO
  uploads: boolean
  port: string | null
}) {
  const [tab, setTab] = React.useState<Tab>("content")
  const [slug, setSlug] = React.useState(saved.slug)
  const [template, setTemplate] = React.useState(saved.template)
  const [content, setContent] = React.useState<SiteDraft>(() =>
    toDraft(saved.content)
  )
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
    draftFingerprint(content) !== savedPrint

  const url = siteUrlFor(slug, port)
  const sections = sectionsOf(template)
  const chosen = templateById(template)

  const [uploading, setUploading] = React.useState(false)

  /**
   * Save.
   *
   * Pictures are uploaded here and nowhere else: whatever was chosen goes to
   * storage first, and only the addresses that come back are sent on to be
   * stored. A form abandoned before this point leaves nothing behind.
   */
  async function submit() {
    if (save.isPending || uploading) return

    let ready
    setUploading(true)
    try {
      ready = await commitDraft(content)
    } catch (error) {
      setUploading(false)
      toast.error(
        error instanceof Error ? error.message : "A picture didn't upload"
      )
      return
    }
    setUploading(false)

    const parsed = siteSchema.safeParse({ slug, template, content: ready })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".") || "root"] ??= issue.message
      }
      setErrors(next)
      // The offending field is almost always in the content, so go there.
      if (Object.keys(next).some((key) => key.startsWith("content"))) {
        setTab("content")
      }
      toast.error("Some fields need another look")
      return
    }

    setErrors({})
    save.mutate(parsed.data, {
      onSuccess: () => toast.success("Saved"),
      onError: (error) =>
        reportMutationError(error, (path, message) =>
          setErrors((prev) => ({ ...prev, [path]: message }))
        ),
    })
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
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!dirty || save.isPending || uploading}
              className={primaryButtonClass}
            >
              {uploading
                ? "Uploading pictures…"
                : save.isPending
                  ? "Saving…"
                  : "Save changes"}
            </button>
          </>
        }
      />

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
            // Say what changed, because the form on the next tab will have
            // grown or shrunk to match.
            toast.success(`${templateById(id).name} chosen`)
          }}
        />
      ) : tab === "content" ? (
        <div className="flex flex-col gap-3">
          <p className="text-n-500 m-0 text-[13px]">
            Using <span className="font-semibold">{chosen.name}</span>. It shows{" "}
            {sections.length} sections, and those are the only ones asked for
            below — change the template to change what you can fill in.
          </p>
          <ContentEditor
            content={content}
            sections={sections}
            uploads={uploads}
            errors={errors}
            onChange={setContent}
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
            />
          </div>
        </div>
      )}
    </DashboardMain>
  )
}
