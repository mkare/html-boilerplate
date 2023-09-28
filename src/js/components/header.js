export default function Header() {
  const header = document.getElementById("header");
  const intercept = document.createElement("div");
  const content = document.querySelector("#siteMain");

  intercept.setAttribute("data-observer-intercept", "");
  content.before(intercept);

  const observer = new IntersectionObserver(([entry]) => {
    header.classList.toggle("active", !entry.isIntersecting);
  });

  observer.observe(intercept);
}
