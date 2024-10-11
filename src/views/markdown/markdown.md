**File:** _./markdown.md_

### H3
#### H4

**Bold** _Italic_

> **Note**
>
> This is a blockquote.

<br>

## Hightlight code blocks

<br>

##### HTML
```html
<p>
  <i>Highlight</i> HTML code in <b>markdown</b>
  <span>span tag</span>
</p>
```

##### Pug
```pug
h1 Inline the markdown text
:markdown
  **Bold** _Italic_ Normal
  - list item 1
  - list item 2
  - list item 3

h1 Include the markdown file
//- load the markdown file in the Pug template
include:markdown ./markdown.md 
```

##### JavaScript
```js
const people = [
  { name: Alex, age: 18 },
  { name: Max, age: 19 },
];
for (let i = 0; i < people.length; i++) {
  let item = people[i];
  console.log(item);
}
```

##### SCSS
```scss
@use 'prismjs';

pre, code {
  font-family: monospace;
}

blockquote {
  border-left: 5px solid #f5f2f0;
  padding-left: 10px;
}
```