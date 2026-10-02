import type { ReactNode } from 'react';

/**
 * Layout for the staff consoles (`/admin`, `/support`).
 *
 * A route group: the `(console)` segment is a grouping construct and does not
 * appear in the URL, so these pages live at `/admin/...` and `/support/...`.
 *
 * The root layout owns `<html>`/`<body>` and must keep rendering the
 * storefront header and footer for every other route, so they cannot be
 * conditionally removed here. Instead this layout marks its subtree with
 * `.console-root`, and `globals.css` uses `:has()` to hide the storefront
 * chrome whenever that marker is present. That keeps the split declarative
 * instead of threading a "is this a console route?" flag through the tree.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <div className="console-root">{children}</div>;
}