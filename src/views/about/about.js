import Base from "@js/layouts/base";

Base();
console.log("Hello World! from about.js");

const app = document.getElementById("app");
const listArray = ["item 1", "item 2", "item 3"];

const list = document.createElement("ul");
list.classList.add("list");

listArray.map((item) => {
  const listItem = document.createElement("li");
  listItem.classList.add("list__item");
  listItem.textContent = item;
  list.appendChild(listItem);
});

app.appendChild(list);

// Boş bir dizi oluşturun
const emptyArray = [];

// 5'ten fazla eleman içeren bir dizi oluşturun
const numbers = [1, 2, 3, 4, 5, 6];

// Dizinin uzunluğunu bulun
console.log("Dizi uzunluğu:", numbers.length);

// Dizinin ilk, orta ve son elemanını alın
console.log("İlk eleman:", numbers[0]);
console.log("Orta eleman:", numbers[Math.floor(numbers.length / 2)]);
console.log("Son eleman:", numbers[numbers.length - 1]);

// Farklı veri tiplerini içeren bir dizi oluşturun ve uzunluğunu bulun
const mixedDataTypes = [1, "Hello", true, null, undefined];
console.log("Karışık veri tipleri dizisinin uzunluğu:", mixedDataTypes.length);

// itCompanies adında bir dizi oluşturun
const itCompanies = [
  "Facebook",
  "Google",
  "Microsoft",
  "Apple",
  "IBM",
  "Oracle",
  "Amazon",
];
