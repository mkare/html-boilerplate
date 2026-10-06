# Auth form controller

`mountAuthForm(form, { adapter })` progressively enhances a single login,
registration, or recovery form. The page must render a disabled
`fieldset[data-auth-fields]` and a visible demo explanation. The controller
attaches validation, password visibility, pending state, feedback, and cleanup
before it enables that fieldset. With JavaScript unavailable, the form cannot
submit or send credentials.

Adapters implement `submit(payload, { signal })` and resolve to one of these
statuses: `success`, `demo`, `field-error`, `error`, `cancelled`, or `not-found`.
`field-error` may include a `fields` object keyed by input `name`. The demo
adapter uses `demo` with informational presentation and explicitly reports that
no server request, account, or session was created. A production adapter must submit to a real configured endpoint and
rely on server-side validation; it must not store credentials in browser
storage. Abort pending work on `destroy()` and do not update the DOM after it.

`createFetchAuthAdapter({ endpoint, method, headers, credentials })` provides
an explicit JSON endpoint adapter for sites that have a backend. It is never
selected implicitly. Configure the page's real `action` and `method` as well
when the no-JavaScript form should submit natively.

Password confirmation uses `data-matches="password"` and may name its live
message node with `data-match-message="#password-match-message"`. Password
toggle buttons use `data-password-toggle` and `aria-controls` pointing to an
input inside the same form.
