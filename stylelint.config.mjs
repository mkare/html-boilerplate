export default {
  extends: ["stylelint-config-standard-scss"],
  customSyntax: "postcss-scss",
  ignoreFiles: ["node_modules/**", "dist/**", ".generated/**", "releases/**"],
  rules: {
    // The project uses BEM element/modifier classes and semantic token names.
    "selector-class-pattern": null,
    "custom-property-pattern": null,
    "scss/dollar-variable-pattern": null,

    // Existing source uses compact rule blocks and legacy color syntax. Keep
    // those formatting choices stable while checking semantic CSS/SCSS rules.
    "declaration-block-single-line-max-declarations": null,
    "rule-empty-line-before": null,
    "at-rule-empty-line-before": null,
    "declaration-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "scss/dollar-variable-empty-line-before": null,
    "scss/double-slash-comment-empty-line-before": null,
    "color-function-alias-notation": null,
    "color-function-notation": null,
    "alpha-value-notation": null,
    "media-feature-range-notation": null,
    "color-hex-length": null,
    "value-keyword-case": null,
    "font-family-name-quotes": null,
    "selector-not-notation": null,
  },
};
