// Default Page Prototype
module.exports = {

  redirectList: [],

  /*
    页面跳转相关
    Wx.js 注入成功后，页面跳转无需单独写跳转函数，有两种方法可在 wxml 中直接定义跳转：
    1. <view catchtap="go" data-to="pagename?key1=value1&key2=value2">
    2. <view catchtap="go" data-to="pagename" data-key1="value1" data-key2="value2">
    说明：
    - 两种写法可以混用，Wx.js 会自动将非 to 的 data 字段拼接到 url 末尾；
    - 请注意，当某一字段所带值为 undefined/null 时，它不会被拼接到 url 上
    - pagename表示页面名称，您可以在 wx.js 的配置中设置页面名称到页面地址的转换函数；
    - go 会自动根据以下四种跳转规则选择使用 navigate（新页面打开）还是 redirect（原页面打开）：

    1. 若源页面的 redirectList 中含有目标页面名，则源页面跳转到目标页面使用 redirect；
    2. 若 wx.js/config/stopPoints 中的任意一个页面在跳转栈中且不在最顶层，则任何跳转都使用 redirect；
    3. 若跳转栈已达5层，此时的任何跳转都强制使用 redirect；
    4. 其余情况，使用 navigate。
  */
  parseJumpEvent: function (event) {
    let params = event.currentTarget.dataset
    let to = params.to
    let url = wx.$.config.pageFormatter(to)
    let regex = /^\//g

    let pages = getCurrentPages()
    if (to === 'self') {
      url = '/' + pages[pages.length - 1].__route__.replace(regex, '')
    }
    for (let key in params) {
      if (key !== 'to') {
        url += (url.indexOf('?') === -1 ? '?' : '&') + key + '=' + params[key];
      }
    }
    return url
  },

  /*
    redirect: （强制）重定向到某页面
    只做重定向，不做其他任何事情
  */
  redirect: function (event) {
    let that = this
    let url = that.parseJumpEvent(event)
    let parts = url.match(/^([^\?]+)(\?[^\?]+)?$/)

    let pages = getCurrentPages()
    let regex = /^\//g
    if (pages[pages.length - 1].__route__.replace(regex, '') === parts[1].replace(regex, '')) {
      wx.$.log('redirect', 'Filtered Self-redirection', '', 'Note: To force going to the same page, please use catchtap="go" data-to="self"')
      return
    }

    wx.$.log('redirect', parts[1], parts[2] || '(No non-null params)')
    wx.redirectTo({ url: url })
  },

  /*
    navigate: 跳转到某页面；若跳转栈满，重定向到某页面
  */
  navigate: function (event) {
    let that = this
    let url = that.parseJumpEvent(event)
    let parts = url.match(/^([^\?]+)(\?[^\?]+)?$/)

    let pages = getCurrentPages()
    let regex = /^\//g
    if (pages[pages.length - 1].__route__.replace(regex, '') === parts[1].replace(regex, '')) {
      wx.$.log('navigate', 'Filtered Self-navigation', '', 'Note: To force going to the same page, please use catchtap="go" data-to="self"')
      return
    }

    // 此处支持第三条跳转规则
    // 解释详见本文件开头
    if (pages.length < 5) {
      wx.$.log('navigate', parts[1], parts[2] || '(No non-null params)')
      wx.navigateTo({ url: url })
    } else {
      wx.$.log('redirect', parts[1], parts[2] || '(No non-null params)', 'Note: Navigation stack is full. Using redirectTo instead.')
      wx.redirectTo({ url: url })
    }
  },

  /*
    go: 根据当前页内部 redirectList 控制，选择跳转或重定向到某页面
    若 redirectList 包含要跳转到的页面，则调用上面的 redirect；否则调用上面的 navigate。
  */
  go: function (event) {
    let that = this
    let page = event.currentTarget.dataset.to.split('?')[0]

    // 此处支持第一条跳转规则
    // 解释详见本文件开头
    if (that.redirectList.map(k => k === page).length) {
      that.redirect(event)
      return
    }

    // 此处支持第二条跳转规则
    // 解释详见本文件开头
    for (let i in wx.$.config.stopPoints) {
      let stopPoint = wx.$.config.stopPoints[i]
      if (getCurrentPages()
        .map(k => '/' + k.__route__.replace(/^\//g, ''))
        .slice(0, -1)
        .filter(k => k === wx.$.config.pageFormatter(stopPoint))
          .length) {
        that.redirect(event)
        return
      }
    }

    // 此处支持第四条跳转规则
    // 解释详见本文件开头
    that.navigate(event)
  },

  /*
    switchTab: 切换 Tab 页面
  */
  switchTab: function (event) {
    let that = this
    wx.switchTab({ url: that.parseJumpEvent(event) })
  },

  /*
    back: 跳转回上一个页面
  */
  back: function () {
    wx.navigateBack()
  },

  /*
    viewimg: 展示图片
    用法：<view catchtap="viewimg" data-current="{{ currentUrl }}" data-urls="{{ arrayOfUrls }}" data-pathmap="image">
    说明：
    - data-current 代表当前要预览的图片
    - data-urls 代表要预览的所有图片列表
    - data-pathmap（可选）
  */
  viewimg: function (event) {
    let current = event.currentTarget.dataset.current
    let urls = event.currentTarget.dataset.urls || [current]
    let pathmap = event.currentTarget.dataset.pathmap
    if (pathmap) {
      let paths = pathmap.split('.')
      for (let route of paths) {
        urls = urls.map(k => k[route]).filter(k => k)
      }
    }
    wx.$.log('viewimg', current || 'default', urls ? 'URLs:' : '', urls || '')
    wx.previewImage({
      current: current,
      urls: urls
    })
  },

  open (event) {
    let url = event.currentTarget.dataset.url
    let noConvert = event.currentTarget.dataset.noconvert
    if (!url) return

    if (/\.(((doc|xls|ppt)x?)|pdf)$/.test(url)) {
      wx.$.util('downloader').download(url)
    } else if (/^(mailto:)?([0-9a-zA-Z\-\._]+@[0-9a-zA-Z\-\._]+)$/.test(url)) {
      wx.$.showActions([
        {
          name: '复制邮件地址', action: () => {
          wx.setClipboardData({
            data: RegExp.$2,
            success: function () {
              wx.$.showSuccess('地址已复制')
            }
          })
        }
        }
      ])
    } else if (noConvert) {
      wx.setClipboardData({ data: url.replace(/\[uuid]/g, wx.$.util('user').getUuid()) })
      wx.$.ask('链接已复制', '微信小程序不允许直接打开链接，你可以粘贴到浏览器打开。')
    } else {
      let pages = getCurrentPages()

      wx.$.log('Convert html page to markdown', url)
      if (pages.slice(-1)[0].__route__.indexOf('pages/markdown/markdown') > -1) {
        if (pages.slice(-1)[0].data.url === url) {
          wx.setClipboardData({ data: url.replace(/\[uuid]/g, wx.$.util('user').getUuid()) })
          wx.$.ask('链接已复制', '微信小程序不允许直接打开链接，你可以粘贴到浏览器打开。')
        } else {
          pages.slice(-1)[0].loadUrl(url)
        }
      } else if (pages.length < 5) {
        wx.navigateTo({ url: '/pages/markdown/markdown?url=' + escape(url) })
      } else {
        wx.redirectTo({ url: '/pages/markdown/markdown?url=' + escape(url) })
      }
    }
  },

  nil: function (event) {

  }
}
