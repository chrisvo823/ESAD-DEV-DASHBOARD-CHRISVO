"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  findCurrentScheduleTaskId,
  findNextScheduleTaskId,
  type DsbScheduleRevision,
} from "../lib/dsb-schedule";

type ScheduleFocus = "current" | "next";

type ScheduleHoverLabelProps = {
  label: string;
  href?: string;
  revisions: DsbScheduleRevision[];
  /** Which schedule step this label represents. */
  focus?: ScheduleFocus;
  /** When set, popup highlight matches the metric display value. */
  focusTaskId?: number;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FocusArrow({ kind }: { kind: ScheduleFocus }) {
  const label = kind === "next" ? "Next" : "Now";
  return (
    <span
      className={`schedule-focus-arrow schedule-focus-arrow--${kind}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 20" width="28" height="20" focusable="false">
        <path
          d="M2 10h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M16 3.5 25 10l-9 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <em>{label}</em>
    </span>
  );
}

export function ScheduleHoverLabel({
  label,
  href,
  revisions,
  focus = "current",
  focusTaskId: focusTaskIdProp,
}: ScheduleHoverLabelProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const focusItemRef = useRef<HTMLLIElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const focusTaskId =
    focusTaskIdProp ??
    (focus === "next"
      ? findNextScheduleTaskId(revisions)
      : findCurrentScheduleTaskId(revisions));

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function placePanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelWidth = Math.min(420, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - panelWidth - 12),
    );
    setCoords({
      top: Math.min(rect.bottom + 10, window.innerHeight - 24),
      left,
    });
  }

  function showPanel() {
    clearCloseTimer();
    placePanel();
    setOpen(true);
  }

  function hidePanelSoon() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }

  useEffect(() => {
    setMounted(true);
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!open) return;

    function onScrollOrResize() {
      placePanel();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || focusTaskId == null) return;
    focusItemRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [open, focusTaskId]);

  const labelNode = href ? (
    <a
      className="metric-link task-hover-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-describedby={open ? panelId : undefined}
      aria-expanded={open}
    >
      {label}
    </a>
  ) : (
    <span
      className="task-hover-link"
      aria-describedby={open ? panelId : undefined}
      aria-expanded={open}
    >
      {label}
    </span>
  );

  const popover =
    mounted &&
    createPortal(
      <div
        id={panelId}
        className={`task-hover-popover task-hover-popover--schedule task-hover-popover--${focus}${open ? " is-open" : ""}`}
        style={{ top: coords.top, left: coords.left }}
        role="tooltip"
        onMouseEnter={showPanel}
        onMouseLeave={hidePanelSoon}
      >
        <header className="task-hover-header">
          <span>{focus === "next" ? "Next step" : "DSB schedule"}</span>
          <strong>{revisions.length}</strong>
        </header>

        {revisions.length === 0 ? (
          <p className="task-hover-empty">No Rev A / Rev B schedule found</p>
        ) : (
          <div className="schedule-revision-stack">
            {revisions.map((revision, revisionIndex) => {
              const revisionHasFocus = revision.tasks.some(
                (task) => task.id === focusTaskId,
              );

              return (
                <section
                  key={revision.id}
                  className={`schedule-revision${revisionHasFocus ? " is-focused" : ""}`}
                  style={{ animationDelay: `${70 + revisionIndex * 60}ms` }}
                >
                  <header className="schedule-revision-header">
                    <a
                      className="schedule-revision-title"
                      href={revision.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {revision.name}
                    </a>
                    <span>
                      {formatDate(revision.start)} → {formatDate(revision.finish)}
                    </span>
                  </header>

                  <ul className="task-hover-list">
                    {revision.tasks.map((task, taskIndex) => {
                      const isFocused = task.id === focusTaskId;

                      return (
                        <li
                          key={task.id}
                          ref={isFocused ? focusItemRef : undefined}
                          className={`task-hover-item${isFocused ? ` is-${focus}-work` : ""}`}
                          style={{
                            animationDelay: `${110 + revisionIndex * 60 + taskIndex * 40}ms`,
                          }}
                        >
                          {isFocused ? <FocusArrow kind={focus} /> : null}
                          <div className="schedule-task-body">
                            <a
                              className="task-hover-key"
                              href={task.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {task.name}
                              {isFocused ? (
                                <span className="visually-hidden">
                                  {focus === "next"
                                    ? " (next step)"
                                    : " (current work)"}
                                </span>
                              ) : null}
                            </a>
                            <div className="task-hover-meta">
                              <span>
                                <em>Start</em>
                                {formatDate(task.start)}
                              </span>
                              <span>
                                <em>Finish</em>
                                {formatDate(task.finish)}
                              </span>
                              <span>
                                <em>Assignee</em>
                                {task.assignee || "Unassigned"}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <span
      ref={triggerRef}
      className={`task-hover-trigger task-hover-trigger--schedule task-hover-trigger--${focus}${open ? " is-open" : ""}`}
      onMouseEnter={showPanel}
      onMouseLeave={hidePanelSoon}
      onFocus={showPanel}
      onBlur={hidePanelSoon}
    >
      {labelNode}
      {popover}
    </span>
  );
}
