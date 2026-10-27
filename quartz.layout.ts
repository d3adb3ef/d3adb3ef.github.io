import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.ProfileCard(),
    Component.PageTitle(),
    Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
  ],
}

export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ContentMeta()],
  left: [
    Component.ProfileCard(),
    Component.PageTitle(),
    Component.Flex({
      components: [
        { Component: Component.Search(), grow: true },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
