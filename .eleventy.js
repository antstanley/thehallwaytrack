const purgecss = require('@fullhuman/postcss-purgecss')
const tailwindcss = require('tailwindcss')
const tailwindConfig = require('./tailwind.config.js')
const postcss = require('postcss')
const { JSDOM } = require('jsdom')
const fs = require('fs')
const CleanCSS = require('clean-css')
// const pluginRSS = require('@11ty/eleventy-plugin-rss')

const cssFiles = [
  './src/web/_includes/css/theme.css',
  './src/web/_includes/css/content.css'
]

const cleanCSSOptions = {
  level: {
    1: {
      specialComments: '0'
    },
    2: {
      all: true,
      removeDuplicateRules: true
    }
  }
}

const insertCss = async (html, css) => {
  const dom = new JSDOM(html)

  const { document } = dom.window

  let head = document.getElementsByTagName('head')[0]
  let style = document.createElement('style')
  style.innerHTML = css
  head.appendChild(style)

  return dom.serialize()
}

module.exports = function (eleventyConfig) {
  // Copy the `img/` directory

  eleventyConfig.addPassthroughCopy('src/web/img')
  eleventyConfig.addPassthroughCopy('src/web/assets')
  eleventyConfig.addPassthroughCopy('src/web/js')

  eleventyConfig.addTransform('purgeCSS', async (content, outputPath) => {
    if (outputPath.endsWith('.html')) {
      const htmlContent = {
        extension: 'html',
        raw: content
      }
      const purgecssConfig = {
        content: [htmlContent],
        defaultExtractor: content => {
          // Capture as liberally as possible, including things like `h-(screen-1.5)`
          const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || []

          // Capture classes within other delimiters like .block(class="w-1/2") in Pug
          const innerMatches =
            content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || []

          return broadMatches.concat(innerMatches)
        }
      }

      const cssProcessor = await postcss([
        tailwindcss(tailwindConfig),
        purgecss(purgecssConfig)
      ])

      let cssMerge = ''

      for (let i = 0; i < cssFiles.length; i++) {
        const css = fs.readFileSync(cssFiles[i], 'utf-8')

        const rootCSS = await cssProcessor.process(css, { from: cssFiles[i] })
        cssMerge = cssMerge.concat(rootCSS.css)
      }

      const cssMin = new CleanCSS(cleanCSSOptions).minify(cssMerge).styles
      return await insertCss(content, cssMin)
    } else {
      return content
    }
  })

  // eleventyConfig.addPlugin(pluginRSS)

  eleventyConfig.addFilter('getReadingTime', text => {
    const wordsPerMinute = 200
    const numberOfWords = text.split(/\s/g).length
    return Math.ceil(numberOfWords / wordsPerMinute)
  })

  // Date formatting filter
  eleventyConfig.addFilter('htmlDateString', dateObj => {
    return new Date(dateObj).toISOString().split('T')[0]
  })

  return {
    passthroughFileCopy: true,
    dir: {
      input: 'src/web',
      output: 'dist/web'
    },
    markdownTemplateEngine: 'njk'
  }
}
