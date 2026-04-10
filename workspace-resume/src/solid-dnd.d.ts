import "solid-js";
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      draggable: true;
      droppable: true;
      sortable: true;
    }
  }
}
