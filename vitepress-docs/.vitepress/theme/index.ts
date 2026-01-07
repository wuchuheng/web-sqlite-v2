import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import HomePage from "./components/HomePage.vue";
import ImagePreviewer from "./components/ImagePreviewer.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      "home-hero-before": () => h(HomePage),
      "layout-bottom": () => h(ImagePreviewer),
    });
  },
};
