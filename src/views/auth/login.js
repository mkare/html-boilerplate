import { createDemoAuthAdapter, mountAuthForm } from "@features/auth/form-controller";

document.querySelectorAll('[data-auth-form][data-auth-mode="login"]').forEach((form) => {
  mountAuthForm(form, { adapter: createDemoAuthAdapter("Sign in") });
});
