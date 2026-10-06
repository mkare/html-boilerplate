import { createDemoAuthAdapter, mountAuthForm } from "@features/auth/form-controller";

document.querySelectorAll('[data-auth-form][data-auth-mode="register"]').forEach((form) => {
  mountAuthForm(form, { adapter: createDemoAuthAdapter("Create account") });
});
