export function renderComments(list, comments) {
  list.innerHTML = comments
    .map((c) => `<li><strong>${c.author}</strong> ${c.body}</li>`)
    .join('');
}
