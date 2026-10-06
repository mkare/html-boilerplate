import { createDemoAuthAdapter, mountAuthForm } from "@features/auth/form-controller";

document.querySelectorAll('[data-auth-form][data-auth-mode="recovery"]').forEach((form) => {
  mountAuthForm(form, { adapter: createDemoAuthAdapter("Password reset") });
});
