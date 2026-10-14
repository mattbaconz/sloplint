export function renderComments(list, comments) {
  list.replaceChildren(
    ...comments.map((c) => {
      const li = document.createElement('li');
      const author = document.createElement('strong');
      author.textContent = c.author;
      li.append(author, ` ${c.body}`);
      return li;
    }),
  );
}
