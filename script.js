// Filtra las filas existentes por cualquier texto de la fila, incluido el código
// que se muestra debajo del nombre del artículo. No modifica los datos.
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('inventoryTableBody');

  if (!searchInput || !tableBody) return;

  const filterRows = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();

    for (const row of tableBody.rows) {
      const rowText = row.textContent.toLocaleLowerCase();
      row.hidden = query !== '' && !rowText.includes(query);
    }
  };

  searchInput.addEventListener('input', filterRows);

  // Vuelve a aplicar la búsqueda si la aplicación actualiza o agrega filas.
  new MutationObserver(filterRows).observe(tableBody, { childList: true, subtree: true });
});
