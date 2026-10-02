import useAppStore from "@/store";

/**
 * Opens a SQL tab selecting from a table (or view/dictionary), or switches to
 * it if it's already open. Used by the explorer's "Query Table" action and the
 * table info page's Query button.
 */
export function openTableQueryTab(database: string, table: string) {
  const title = `Query - ${table}`;
  const query = `SELECT * FROM \`${database}\`.\`${table}\` LIMIT 1000`;
  useAppStore.getState().addTab({
    // Includes the database so same-named tables in different databases
    // don't share a tab
    id: `query-${database}.${table}`,
    type: "sql",
    title,
    content: `-- ${title}\n${query}`,
  });
}
