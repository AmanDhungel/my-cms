import Link from "next/link";

import { ScrollEffects } from "@/components/landing/scroll-effects";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { TaskBeacon } from "@/components/landing/task-beacon";
import { StatusBadge } from "@/components/status-badge";
import { TaskCard } from "@/components/task-card";
import type { TaskStatus } from "@/lib/task-status";

const STATS = [
  { value: "100 m", label: "GEOFENCE RADIUS" },
  { value: "6 states", label: "TASK LIFECYCLE" },
  { value: "Offline", label: "CHECK-IN QUEUE" },
];

const STEPS = [
  {
    step: "01",
    title: "Task created",
    body: "Title, destination, start time, deadline, priority. Assigned to one employee.",
    note: "POST /tasks",
  },
  {
    step: "02",
    title: "Employee notified",
    body: "Push lands immediately. If no check-in by start time, a nudge fires on a delayed job.",
    note: "task_assigned",
  },
  {
    step: "03",
    title: "Check-in verified",
    body: "Coordinates measured against the geofence, optional photo attached, owner notified.",
    note: "distance ≤ 100 m",
  },
  {
    step: "04",
    title: "Status closes out",
    body: "In progress, need material, need more time, completed — then the owner verifies and closes.",
    note: "audit trail kept",
    accent: true,
  },
];

/** The chip row; "In progress" is carried by the card beside it. */
const CHIP_STATUSES: TaskStatus[] = [
  "pending",
  "material",
  "time",
  "done",
  "overdue",
];

export default function Home() {
  return (
    <>
      <ScrollEffects />

      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-60 h-[3px] bg-[rgba(27,24,21,0.06)]">
        <div data-scroll-progress className="bg-p-500 h-full w-0" />
      </div>

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative grid min-h-[calc(100vh-60px)] items-center gap-10 overflow-hidden px-6 pb-20 sm:px-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[10%] -right-[8%] h-[120%] w-[60%] bg-[radial-gradient(closest-side,rgba(207,237,234,0.55),rgba(250,249,247,0))]"
          />

          <div className="relative flex max-w-[620px] flex-col gap-[22px] pt-16 lg:pt-0">
            <p
              data-reveal
              className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
              Employee management · v1
            </p>
            <h1
              data-reveal
              data-delay="60"
              className="font-heading text-[40px] leading-[1.04] font-bold tracking-[-0.02em] text-balance sm:text-[52px] lg:text-[62px]">
              Assign the work. Watch it land on site.
            </h1>
            <p
              data-reveal
              data-delay="120"
              className="text-n-600 max-w-[520px] text-[17px] leading-[1.65] text-pretty">
              Owners create located tasks. Employees check in inside the
              geofence. Status flows back the moment it changes — no phone
              calls, no guessing where the crew is.
            </p>
            <div
              data-reveal
              data-delay="180"
              className="flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="bg-p-500 rounded-md px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(14,124,123,0.24)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-[1.06]">
                Create a workspace
              </Link>
              <Link
                href="/login"
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border px-[22px] py-3.5 text-[15px] font-semibold transition-colors">
                I already have an account
              </Link>
            </div>
            <dl
              data-reveal
              data-delay="240"
              className="border-n-300 flex flex-wrap gap-5 border-t border-dashed pt-2.5">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-0.5">
                  <dt className="font-heading text-xl font-semibold">
                    {stat.value}
                  </dt>
                  <dd className="text-n-500 font-mono text-[11px]">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <TaskBeacon />

          <div
            aria-hidden
            className="text-n-500 absolute bottom-6 left-6 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.1em] sm:left-10">
            <span className="bg-n-300 block h-[34px] w-px [animation:ems-cue-drop_2.2s_ease-in-out_infinite]" />
            SCROLL
          </div>
        </section>

        {/* 01 — The problem */}
        <section className="relative flex h-[92vh] min-h-[560px] items-center overflow-hidden bg-[repeating-linear-gradient(118deg,#094F4E_0_26px,#073C3B_26px_52px)] bg-fixed">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,42,41,0.86),rgba(5,42,41,0.42))]"
          />
          <div
            data-para="0.10"
            className="relative max-w-[900px] px-6 sm:px-10">
            <p
              data-reveal
              className="text-p-200 mb-[18px] font-mono text-xs tracking-[0.1em] uppercase">
              01 — The problem
            </p>
            <h2
              data-reveal
              data-delay="80"
              className="font-heading text-p-50 max-w-[760px] text-[32px] leading-[1.16] font-semibold tracking-[-0.015em] text-pretty sm:text-[46px]">
              A check-in button that anyone can press from the couch isn&rsquo;t
              a check-in.
            </h2>
            <p
              data-reveal
              data-delay="160"
              className="text-p-100 mt-[22px] max-w-[560px] text-[17px] leading-[1.7]">
              So every arrival is measured against the task&rsquo;s coordinates,
              logged with distance, and stamped in the audit trail. The owner
              sees it the second it happens.
            </p>
          </div>
          <span className="absolute bottom-[22px] left-6 font-mono text-[11px] tracking-[0.06em] text-[rgba(234,246,245,0.5)] sm:left-10">
            photo — crew arriving on site · 1920×1080
          </span>
        </section>

        {/* 02 — The loop */}
        <section
          id="flow"
          data-fill-scope
          className="bg-n-50 px-6 pt-[110px] pb-[120px] sm:px-10">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-11">
            <div className="flex max-w-[640px] flex-col gap-3">
              <p
                data-reveal
                className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
                02 — The loop
              </p>
              <h2
                data-reveal
                data-delay="60"
                className="font-heading text-[30px] leading-[1.2] font-semibold tracking-[-0.015em] sm:text-[38px]">
                Four steps, and the day reports itself.
              </h2>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="bg-n-200 absolute top-[26px] right-[6%] left-[6%] hidden h-0.5 lg:block"
              />
              <div
                data-fill
                aria-hidden
                className="bg-p-500 absolute top-[26px] right-[6%] left-[6%] hidden h-0.5 origin-left scale-x-0 transition-transform duration-[250ms] ease-linear lg:block"
              />
              <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((item, index) => (
                  <li
                    key={item.step}
                    data-reveal
                    data-delay={index * 110}
                    className="flex flex-col gap-3.5">
                    <span
                      className={
                        item.accent
                          ? "bg-a-50 border-a-400 text-a-700 font-heading flex size-[54px] items-center justify-center rounded-full border-2 text-base font-semibold"
                          : "bg-n-50 border-p-500 text-p-700 font-heading flex size-[54px] items-center justify-center rounded-full border-2 text-base font-semibold"
                      }>
                      {item.step}
                    </span>
                    <h3 className="font-heading text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-n-600 text-[14.5px] leading-relaxed">
                      {item.body}
                    </p>
                    <span className="text-n-400 font-mono text-[11px]">
                      {item.note}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 03 — What the owner sees */}
        <section id="proof" className="bg-n-50 pb-[120px]">
          <div className="mx-auto grid max-w-[1080px] items-center gap-14 px-6 sm:px-10 lg:grid-cols-2">
            <div data-reveal className="flex flex-col gap-[18px]">
              <p className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
                03 — What the owner sees
              </p>
              <h2 className="font-heading text-[28px] leading-[1.22] font-semibold tracking-[-0.015em] sm:text-[34px]">
                One card per task. Colour never carries the meaning alone.
              </h2>
              <p className="text-n-600 max-w-[440px] text-base leading-[1.7]">
                Every status dot ships with a label, so it still reads correctly
                for a colour-blind supervisor glancing at a phone in bright
                sunlight.
              </p>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {CHIP_STATUSES.map((status) => (
                  <StatusBadge key={status} status={status} />
                ))}
              </div>
            </div>

            <div
              data-reveal
              data-delay="120"
              data-para="0.05"
              className="lg:justify-self-end">
              <TaskCard
                task={{
                  id: "#TASK-0412",
                  title: "Warehouse restock — Bay 3",
                  location: "Balaju Industrial Area",
                  owner: "RS",
                  status: "progress",
                  deadline: "5:00 PM",
                  checkIn: "Check-in verified within 100m",
                }}
              />
            </div>
          </div>
        </section>

        {/* 04 — Marigold is a request */}
        <section className="relative flex h-[86vh] min-h-[520px] items-center overflow-hidden bg-[repeating-linear-gradient(118deg,#563605_0_26px,#331F03_26px_52px)] bg-fixed">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(51,31,3,0.82),rgba(51,31,3,0.35))]"
          />
          <div
            data-para="0.10"
            className="relative max-w-[900px] px-6 sm:px-10">
            <p
              data-reveal
              className="text-a-200 mb-[18px] font-mono text-xs tracking-[0.1em] uppercase">
              04 — Marigold is a request
            </p>
            <h2
              data-reveal
              data-delay="80"
              className="font-heading text-a-50 max-w-[720px] text-[30px] leading-[1.16] font-semibold tracking-[-0.015em] text-pretty sm:text-[44px]">
              If it&rsquo;s this colour, somebody needs a hand raised. Nothing
              else gets to use it.
            </h2>
            <p
              data-reveal
              data-delay="160"
              className="text-a-100 mt-[22px] max-w-[540px] text-[17px] leading-[1.7]">
              Leave requests, advance payments, blocked tasks waiting on
              material. Everything else stays quiet in warm neutrals.
            </p>
          </div>
          <span className="absolute bottom-[22px] left-6 font-mono text-[11px] tracking-[0.06em] text-[rgba(253,246,233,0.55)] sm:left-10">
            photo — supervisor reviewing requests · 1920×1080
          </span>
        </section>

        {/* Start the loop */}
        <section className="bg-n-50 px-6 py-[120px] sm:px-10">
          <div
            data-reveal
            className="mx-auto flex max-w-[760px] flex-col items-center gap-[22px] text-center">
            <p className="text-p-600 font-mono text-xs tracking-[0.08em] uppercase">
              Start the loop
            </p>
            <h2 className="font-heading text-[34px] leading-[1.14] font-bold tracking-[-0.02em] sm:text-[44px]">
              Set up your workspace in a few minutes.
            </h2>
            <p className="text-n-600 max-w-[520px] text-[16.5px] leading-[1.7]">
              Create the business, invite your crew by link, assign the first
              located task today.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="bg-p-500 rounded-md px-[26px] py-3.5 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(14,124,123,0.24)] transition-transform hover:-translate-y-0.5">
                Create a workspace
              </Link>
              <Link
                href="/login"
                className="border-n-300 text-n-700 hover:bg-n-100 rounded-md border px-6 py-3.5 text-[15px] font-semibold transition-colors">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
