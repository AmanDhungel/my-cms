"use client"

import * as React from "react"
import { cn } from "cn"

import { FieldError, FieldLabel, inputClass } from "@/components/auth/field"
import { ImagePicker } from "@/components/dashboard/image-picker"
import { PlusIcon } from "@/components/dashboard/nav-icons"
import {
  LIMITS,
  SECTION_HINTS,
  SECTION_LABELS,
  type SectionKey,
} from "@/lib/site-templates"
import type { SiteDraft } from "@/components/dashboard/site/site-draft"
import { emptyImage } from "@/lib/upload-client"

/**
 * The form.
 *
 * It offers exactly the fields the chosen template will draw, and nothing
 * else. That is the whole point: a template with no gallery gives you no
 * gallery to fill in, so a site can't be full of text that never appears and
 * an owner is never asked a question their page has no room for.
 *
 * Switching template changes which parts are on screen; it never throws any
 * of them away, because every layout reads the same stored shape.
 */
export function ContentEditor({
  content,
  sections,
  uploads,
  errors,
  onChange,
}: {
  content: SiteDraft
  sections: SectionKey[]
  uploads: boolean
  errors: Record<string, string>
  onChange: (next: SiteDraft) => void
}) {
  const shows = (key: SectionKey) => sections.includes(key)

  /** A shallow update of one top-level part. */
  function set<K extends keyof SiteDraft>(key: K, value: SiteDraft[K]) {
    onChange({ ...content, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Always asked: every template puts the name somewhere. */}
      <Block title="The basics" hint="Shown on every template.">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Text
            label="Business name"
            value={content.name}
            error={errors["content.name"]}
            onChange={(value) => set("name", value ?? "")}
            placeholder="Balaju Electricals"
          />
          <Text
            label="Tagline"
            value={content.tagline}
            error={errors["content.tagline"]}
            onChange={(value) => set("tagline", value)}
            placeholder="Wiring and repairs since 2009"
          />
        </div>
        <Area
          label="Short description"
          hint="Used by search engines and when the link is shared."
          value={content.description}
          error={errors["content.description"]}
          onChange={(value) => set("description", value)}
          rows={2}
        />
      </Block>

      {shows("hero") ? (
        <Block title={SECTION_LABELS.hero} hint={SECTION_HINTS.hero}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Text
              label="Headline"
              value={content.hero.headline}
              error={errors["content.hero.headline"]}
              onChange={(value) =>
                set("hero", { ...content.hero, headline: value })
              }
              placeholder={content.name || "What you do, in one line"}
            />
            <Text
              label="Supporting line"
              value={content.hero.sub}
              error={errors["content.hero.sub"]}
              onChange={(value) => set("hero", { ...content.hero, sub: value })}
              placeholder="A sentence that says who it's for"
            />
            <Text
              label="Button text"
              hint="Leave empty for no button."
              value={content.hero.ctaLabel}
              error={errors["content.hero.ctaLabel"]}
              onChange={(value) =>
                set("hero", { ...content.hero, ctaLabel: value })
              }
              placeholder="Call us"
            />
            <Text
              label="Button link"
              hint="Defaults to your phone number."
              value={content.hero.ctaHref}
              error={errors["content.hero.ctaHref"]}
              onChange={(value) =>
                set("hero", { ...content.hero, ctaHref: value })
              }
              placeholder="tel:+977…"
            />
          </div>
          <ImagePicker
            label="Opening picture"
            hint="Wide works best here."
            enabled={uploads}
            value={content.hero.image}
            onChange={(image) => set("hero", { ...content.hero, image })}
          />
        </Block>
      ) : null}

      {shows("about") ? (
        <Block title={SECTION_LABELS.about} hint={SECTION_HINTS.about}>
          <Text
            label="Heading"
            value={content.about.title}
            error={errors["content.about.title"]}
            onChange={(value) => set("about", { ...content.about, title: value })}
            placeholder="About us"
          />
          <Area
            label="The text"
            hint="Leave a blank line between paragraphs."
            value={content.about.body}
            error={errors["content.about.body"]}
            onChange={(value) => set("about", { ...content.about, body: value })}
            rows={6}
          />
          <ImagePicker
            label="Picture"
            enabled={uploads}
            ratio="4/3"
            value={content.about.image}
            onChange={(image) => set("about", { ...content.about, image })}
          />
        </Block>
      ) : null}

      {shows("services") ? (
        <Block
          title={SECTION_LABELS.services}
          hint={SECTION_HINTS.services}
          count={`${content.services.length} of ${LIMITS.services}`}
        >
          <Repeater
            rows={content.services}
            limit={LIMITS.services}
            addLabel="Add a service"
            blank={{ title: "", body: null }}
            onChange={(rows) => set("services", rows)}
            render={(row, update, index) => (
              <>
                <Text
                  label="Name"
                  value={row.title}
                  error={errors[`content.services.${index}.title`]}
                  onChange={(value) => update({ ...row, title: value ?? "" })}
                  placeholder="House rewiring"
                />
                <Area
                  label="What it involves"
                  value={row.body}
                  error={errors[`content.services.${index}.body`]}
                  onChange={(value) => update({ ...row, body: value })}
                  rows={2}
                />
              </>
            )}
          />
        </Block>
      ) : null}

      {shows("products") ? (
        <Block
          title={SECTION_LABELS.products}
          hint={SECTION_HINTS.products}
          count={`${content.products.length} of ${LIMITS.products}`}
        >
          <Repeater
            rows={content.products}
            limit={LIMITS.products}
            addLabel="Add a product"
            blank={{ name: "", blurb: null, price: null, image: emptyImage() }}
            onChange={(rows) => set("products", rows)}
            render={(row, update, index) => (
              <>
                <div className="grid gap-3.5 sm:grid-cols-[1.6fr_1fr]">
                  <Text
                    label="Name"
                    value={row.name}
                    error={errors[`content.products.${index}.name`]}
                    onChange={(value) => update({ ...row, name: value ?? "" })}
                    placeholder="2.5mm copper cable"
                  />
                  <Text
                    label="Price"
                    hint="However you say it."
                    value={row.price}
                    error={errors[`content.products.${index}.price`]}
                    onChange={(value) => update({ ...row, price: value })}
                    placeholder="from Rs 2,400"
                  />
                </div>
                <Area
                  label="Description"
                  value={row.blurb}
                  error={errors[`content.products.${index}.blurb`]}
                  onChange={(value) => update({ ...row, blurb: value })}
                  rows={2}
                />
                <ImagePicker
                  label="Picture"
                  enabled={uploads}
                  ratio="4/3"
                  value={row.image}
                  onChange={(image) => update({ ...row, image })}
                />
              </>
            )}
          />
        </Block>
      ) : null}

      {shows("gallery") ? (
        <Block
          title={SECTION_LABELS.gallery}
          hint={SECTION_HINTS.gallery}
          count={`${content.gallery.length} of ${LIMITS.gallery}`}
        >
          <Repeater
            rows={content.gallery}
            limit={LIMITS.gallery}
            addLabel="Add a picture"
            blank={{ url: emptyImage(), caption: null }}
            onChange={(rows) => set("gallery", rows)}
            render={(row, update) => (
              <>
                <ImagePicker
                  label="Picture"
                  enabled={uploads}
                  ratio="1/1"
                  value={row.url}
                  onChange={(image) => update({ ...row, url: image })}
                />
                <Text
                  label="Caption"
                  value={row.caption}
                  onChange={(value) => update({ ...row, caption: value })}
                  placeholder="Optional"
                />
              </>
            )}
          />
        </Block>
      ) : null}

      {shows("faq") ? (
        <Block
          title={SECTION_LABELS.faq}
          hint={SECTION_HINTS.faq}
          count={`${content.faq.length} of ${LIMITS.faq}`}
        >
          <Repeater
            rows={content.faq}
            limit={LIMITS.faq}
            addLabel="Add a question"
            blank={{ question: "", answer: "" }}
            onChange={(rows) => set("faq", rows)}
            render={(row, update, index) => (
              <>
                <Text
                  label="Question"
                  value={row.question}
                  error={errors[`content.faq.${index}.question`]}
                  onChange={(value) => update({ ...row, question: value ?? "" })}
                  placeholder="Do you work on Saturdays?"
                />
                <Area
                  label="Answer"
                  value={row.answer}
                  error={errors[`content.faq.${index}.answer`]}
                  onChange={(value) => update({ ...row, answer: value ?? "" })}
                  rows={3}
                />
              </>
            )}
          />
        </Block>
      ) : null}

      {shows("contact") ? (
        <Block title={SECTION_LABELS.contact} hint={SECTION_HINTS.contact}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Text
              label="Phone"
              value={content.contact.phone}
              error={errors["content.contact.phone"]}
              onChange={(value) =>
                set("contact", { ...content.contact, phone: value })
              }
              placeholder="+977 9801 234 567"
            />
            <Text
              label="Email"
              value={content.contact.email}
              error={errors["content.contact.email"]}
              onChange={(value) =>
                set("contact", { ...content.contact, email: value })
              }
              placeholder="hello@example.com"
            />
            <Text
              label="Address"
              value={content.contact.address}
              error={errors["content.contact.address"]}
              onChange={(value) =>
                set("contact", { ...content.contact, address: value })
              }
              placeholder="Balaju, Kathmandu"
            />
            <Text
              label="Opening hours"
              value={content.contact.hours}
              error={errors["content.contact.hours"]}
              onChange={(value) =>
                set("contact", { ...content.contact, hours: value })
              }
              placeholder="Sun–Fri, 9 to 6"
            />
          </div>
          <Text
            label="Map link"
            hint="Optional. The address links to it."
            value={content.contact.mapUrl}
            error={errors["content.contact.mapUrl"]}
            onChange={(value) =>
              set("contact", { ...content.contact, mapUrl: value })
            }
            placeholder="https://maps.google.com/…"
          />
        </Block>
      ) : null}
    </div>
  )
}

function Block({
  title,
  hint,
  count,
  children,
}: {
  title: string
  hint?: string
  count?: string
  children: React.ReactNode
}) {
  return (
    <section
      data-editor-block={title}
      className="border-n-200 flex flex-col gap-3.5 rounded-[14px] border bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading m-0 text-[15.5px] font-semibold">
            {title}
          </h3>
          {hint ? (
            <span className="text-n-500 text-[12.5px]">{hint}</span>
          ) : null}
        </div>
        {count ? (
          <span className="text-n-400 font-mono text-[11px]">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** A list of the same little form, with add and remove. */
function Repeater<T>({
  rows,
  limit,
  addLabel,
  blank,
  onChange,
  render,
}: {
  rows: T[]
  limit: number
  addLabel: string
  blank: T
  onChange: (rows: T[]) => void
  render: (row: T, update: (next: T) => void, index: number) => React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <div
          key={index}
          data-repeater-row
          className="border-n-200 flex flex-col gap-3 rounded-[10px] border border-dashed p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-n-400 font-mono text-[10.5px] tracking-[0.07em]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex gap-1">
              <Move
                label="Move up"
                glyph="↑"
                disabled={index === 0}
                onClick={() => onChange(swap(rows, index, index - 1))}
              />
              <Move
                label="Move down"
                glyph="↓"
                disabled={index === rows.length - 1}
                onClick={() => onChange(swap(rows, index, index + 1))}
              />
              <button
                type="button"
                aria-label={`Remove ${index + 1}`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="border-n-300 text-n-500 hover:text-s-overdue rounded-md border bg-white px-2 py-1 text-[12px] leading-none"
              >
                ×
              </button>
            </div>
          </div>
          {render(row, (next) => onChange(replace(rows, index, next)), index)}
        </div>
      ))}

      {rows.length < limit ? (
        <button
          type="button"
          onClick={() => onChange([...rows, structuredClone(blank)])}
          className="border-n-300 text-n-700 hover:bg-n-100 flex w-fit items-center gap-1.5 rounded-md border border-dashed bg-white px-3 py-2 text-[13px] font-semibold"
        >
          <PlusIcon className="size-3.5" />
          {addLabel}
        </button>
      ) : (
        <span className="text-n-500 text-[12.5px]">
          That is the most this template will show.
        </span>
      )}
    </div>
  )
}

function Move({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string
  glyph: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-n-300 text-n-500 hover:bg-n-100 rounded-md border bg-white px-2 py-1 text-[12px] leading-none disabled:opacity-35"
    >
      {glyph}
    </button>
  )
}

function swap<T>(rows: T[], a: number, b: number) {
  const next = [...rows]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

function replace<T>(rows: T[], index: number, value: T) {
  return rows.map((row, i) => (i === index ? value : row))
}

function Text({
  label,
  hint,
  value,
  error,
  onChange,
  placeholder,
}: {
  label: string
  hint?: string
  value: string | null
  error?: string
  onChange: (value: string | null) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value ?? ""}
        // Empty means "not set", so it is stored as nothing rather than "".
        onChange={(event) => onChange(event.target.value || null)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-label={label}
        className={inputClass}
      />
      {hint && !error ? (
        <span className="text-n-500 text-[11.5px]">{hint}</span>
      ) : null}
      <FieldError message={error} />
    </label>
  )
}

function Area({
  label,
  hint,
  value,
  error,
  onChange,
  rows = 3,
}: {
  label: string
  hint?: string
  value: string | null
  error?: string
  onChange: (value: string | null) => void
  rows?: number
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <FieldLabel>{label}</FieldLabel>
      <textarea
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-label={label}
        className={cn(inputClass, "h-auto resize-y py-2.5 leading-relaxed")}
      />
      {hint && !error ? (
        <span className="text-n-500 text-[11.5px]">{hint}</span>
      ) : null}
      <FieldError message={error} />
    </label>
  )
}
