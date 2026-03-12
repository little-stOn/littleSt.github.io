import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: '/littleSt.github.io/',
  title: "littleSt's Blog",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Notes', link: '/notes/', activeMatch: '/notes/' }
    ],

    sidebar: [
      {
        text: 'Notes',
        items: [
          { text: '机器学习中的凸优化理论', link: '/notes/optim/note' },
          { text: '线性回归：最小二乘法', link: '/notes/线性回归/最小二乘法' },
          { text: '线性回归：岭回归', link: '/notes/线性回归/岭回归' },
          { text: '线性分类：感知机模型', link: '/notes/线性分类/感知机' },
          { text: 'ARM架构基础：Part 1', link: '/notes/ARM架构/ARM_intro' },
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/little-stOn/littleSt.github.io' }
    ]
  },
  markdown: {
    math: true
  }
})
