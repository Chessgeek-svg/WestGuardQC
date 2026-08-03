/** Marks a lot past its expiration date.
 *
 *  Expiry does not stop a lot being used or evaluated, so this warns rather
 *  than blocks. Deciding a lot is finished is the PATCH that retires it.
 */
export function ExpiredBadge() {
  return (
    <span className="rounded-full border border-amber-500/50 px-2 py-0.5 text-xs font-medium text-amber-400">
      Expired
    </span>
  )
}
