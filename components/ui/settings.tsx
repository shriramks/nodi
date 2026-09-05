import type { ReactNode } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

function joinClasses(classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SettingsPanelProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsPanel({ children, className }: SettingsPanelProps) {
  return (
    <section
      className={joinClasses([
        "space-y-3 rounded-2xl border border-border bg-surface p-4",
        className,
      ])}
    >
      {children}
    </section>
  );
}

type SettingsLinkRowProps = {
  className?: string;
  description?: ReactNode;
  href: string;
  icon: ReactNode;
  status?: ReactNode;
  title: ReactNode;
  titleAccessory?: ReactNode;
};

export function SettingsLinkRow({
  className,
  description,
  href,
  icon,
  status,
  title,
  titleAccessory,
}: SettingsLinkRowProps) {
  return (
    <Link
      href={href}
      className={joinClasses([
        "flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 active:bg-tap-active",
        className,
      ])}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-[15px] font-semibold text-foreground">{title}</span>
          {titleAccessory}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[13px] text-text-muted">{description}</span>
        ) : null}
        {status ? (
          <span className="mt-0.5 block text-[12px] text-text-faint">{status}</span>
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-text-muted" />
    </Link>
  );
}

type SettingsStatusBadgeProps = {
  children: ReactNode;
  size?: "compact" | "default";
  tone?: "active" | "neutral";
};

export function SettingsStatusBadge({
  children,
  size = "default",
  tone = "neutral",
}: SettingsStatusBadgeProps) {
  return (
    <span
      className={joinClasses([
        "rounded-full font-semibold",
        size === "compact" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]",
        tone === "active" ? "bg-watched/15 text-watched" : "bg-surface-muted text-text-2",
      ])}
    >
      {children}
    </span>
  );
}

type SettingsFieldLabelProps = {
  children: ReactNode;
};

export function SettingsFieldLabel({ children }: SettingsFieldLabelProps) {
  return <span className="text-[13px] text-text-muted">{children}</span>;
}

type SettingsTextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function SettingsTextInput({ className, ...props }: SettingsTextInputProps) {
  return (
    <input
      className={joinClasses([
        "mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[16px] outline-none focus:border-accent",
        className,
      ])}
      {...props}
    />
  );
}

type SettingsActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "accent" | "danger" | "neutral";
};

export function SettingsActionButton({
  className,
  tone = "accent",
  type = "button",
  ...props
}: SettingsActionButtonProps) {
  return (
    <button
      className={joinClasses([
        "flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-45",
        tone === "accent" ? "bg-accent/15 text-accent" : undefined,
        tone === "danger" ? "border border-border bg-surface-muted text-unsynced" : undefined,
        tone === "neutral" ? "border border-border bg-surface-muted text-text-muted" : undefined,
        className,
      ])}
      type={type}
      {...props}
    />
  );
}
