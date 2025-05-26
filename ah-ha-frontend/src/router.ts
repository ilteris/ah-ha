import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import MyAhHasView from "./components/MyAhHasView.vue";
import AhHaDetailView from "./components/AhHaDetailView.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "MyAhHas",
    component: MyAhHasView,
  },
  {
    path: "/ah-ha/:id", // Route for individual Ah-ha moment
    name: "AhHaDetail",
    component: AhHaDetailView,
    props: true, // Pass route params as props to the component
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  console.log(`[Router] Navigating from ${from.fullPath} to ${to.fullPath}`);
  next();
});

router.afterEach((to, from) => {
  console.log(`[Router] Navigation to ${to.fullPath} complete.`);
});

export default router;
