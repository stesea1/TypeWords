//@ts-ignore
import VueVirtualScroller from 'vue-virtual-scroller'
import { ENV } from '@/core/config/env.ts'
import { withAppBaseURL } from '@/core/utils/base-url'

export default defineNuxtPlugin(async nuxtApp => {
  // 原项目的访问统计（51.la / 百度统计，用的是原作者的账号），只在官方站点加载，fork 部署的版本不加载
  if (
    location.hostname.endsWith('typewords.cc') &&
    !location.href.includes('localhost') &&
    !location.href.includes('192.168') &&
    !location.href.includes('172.16') &&
    !location.href.includes('10.0')
  ) {
    ;(function () {
      var t = document.createElement('script')
      t.src = ENV.LIBS_URL + 't.js?t=' + Date.now()
      document.head.appendChild(t)
    })()
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(withAppBaseURL('/service-worker.js'))
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope)
        })
        .catch(error => {
          console.log('ServiceWorker registration failed: ', error)
        })
    })
  }

  console.json = function (v: any, space = 0) {
    const json = JSON.stringify(
      v,
      (key, value) => {
        if (Array.isArray(value) && key !== 'nameList') {
          return `__ARRAY__${JSON.stringify(value)}`
        }
        return value
      },
      space
    )
      .replace(/"__ARRAY__(\[.*?\])"/g, (_, arr) => arr)
      // 专门处理 nameList，将其压缩成一行
      .replace(/"nameList": \[\s*([^\]]+)\s*\]/g, (match, content) => {
        // 移除数组内部的换行和多余空格，但保留字符串间的空格
        const compressed = content.replace(/\s*\n\s*/g, ' ').trim()
        return `"nameList": [${compressed}]`
      })

    console.log(json)
    return json
  }
  console.parse = function (v: any) {
    console.log(JSON.parse(v))
  }

  nuxtApp.vueApp.use(VueVirtualScroller)
})
