const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const fs = require("fs");

async function startBrowser() {
  let browser;
  try {
    console.log("Opening the browser......");
    browser = await puppeteer.launch({
      headless: false, //change this to true to make browser invisible
      args: ["--disable-setuid-sandbox"],
      ignoreHTTPSErrors: true,
    });
  } catch (err) {
    console.log("Could not create a browser instance => : ", err);
  }
  return browser;
}

async function scrapeAll(browserInstance) {
  let browser;
  try {
    browser = await browserInstance;
    await scraperObject.scraper(browser);
  } catch (err) {
    console.log("Could not resolve the browser instance => ", err);
  }
}

// insert DOCshop product productItemUrls here to scrape
const scraperObject = {
  //logging in via keyword magic tool page is an easier process than the login button at the top right. ask Daniel for more information.
  // queries
  // q = All-Products
  // from = wangpu
  // pageTypeId == 1 == store mainpage,
  // pageTypeId == 2 == product page,
  // pageTypeId == 3 == profile page
  async scraper(browser) {
    //initializing empty arrays to push into
    let currentPage = 1;
    let url = `https://www.lazada.com.my/lucky-pharmacy-malaysia/?from=wangpu&langFlag=en&page=${currentPage}&pageTypeId=2&q=All-Products`;
    let totalData = [];
    //opening browser & going to url
    let page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 }); //setting wider viewport to load all products
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log(`Navigating to ` + url);
    console.log("page evaluate");

    const lastPage = await page.evaluate(() => {
      paginationBtns = document.querySelectorAll(".ant-pagination-item");
      return paginationBtns[paginationBtns.length - 1].innerText; // last page
    });

    itemLinks = await page.evaluate(() => {
      const productItemUrls = Array.from(
        document.querySelectorAll(".Bm3ON .Ms6aG .qmXQo ._95X4G a"),
        (element) => element.href
      );
      return productItemUrls;
    });

    for (
      currentPage = currentPage + 1;
      currentPage <= lastPage;
      currentPage++
    ) {
      itemLinks = await page.evaluate(() => {
        const productItemUrls = Array.from(
          document.querySelectorAll(".Bm3ON .Ms6aG .qmXQo ._95X4G a"),
          (element) => element.href
        );
        return productItemUrls;
      });
      for (i = 0; i < itemLinks.length; i++) {
        itemLink = itemLinks[i];
        itemPage = await browser.newPage();
        await itemPage.setViewport({ width: 1366, height: 768 }); //setting wider viewport to load all products
        await itemPage.goto(itemLink, { waitUntil: "domcontentloaded" });
        console.log(`Navigating to ` + itemLink);
        await this.getProductDetails(browser, itemPage, totalData);
        await itemPage.close();
      }
      await page.goto(
        `https://www.lazada.com.my/lucky-pharmacy-malaysia/?from=wangpu&langFlag=en&page=${currentPage}&pageTypeId=2&q=All-Products`,
        { waitUntil: "domcontentloaded" }
      );
    }
    console.log("end scrapping item");
  },
  randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  },
  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
  async isCaptcha(page) {
    console.log("checking captcha");
    const captcha = page
      .$$("#nocaptcha")
      .then((captcha) => {
        console.log(captcha);
        return true;
      })
      .catch((error) => {
        return false;
      });
  },
  async getProductDetails(browser, page, totalData) {
    // waiter not exceed 10 pages
    while ((await browser.pages()).length >= 10) {}

    // while (this.isCaptcha) {
    //   console.log("captcha detected");
    //   console.log("itemLink = " + itemLink);
    //   // await page.reload({ waitUntil: "networkidle0", timeout: 0 });
    //   page.close()
    //   return
    // }
    const dataOfItem = await page.evaluate(() => {
      const title = document.querySelector(
        ".pdp-mod-product-badge-title"
      ).innerText;
      const rating = document
        .querySelector(".pdp-review-summary__link")
        .innerText.split(" ")[0];
      let price = document.querySelector(".pdp-price").innerText;
      //if sku-prop-content is not found, it will return 0
      // milisecond = this.randomIntFromInterval(2,5) * 1000;
      // this.sleep(milisecond);
      let modelName = "";
      if (document.querySelector(".sku-name")) {
        modelName = document.querySelector(".sku-name").innerText;
      }
      console.log(modelName);

      return {
        title: title ? title : "",
        rating: rating ? rating : "",
        price: price,
      };
    });
    totalData.push(dataOfItem);

    fs.writeFile("items.json", JSON.stringify(totalData), (err) => {
      if (err) {
        throw err;
      }
    });
  },
};

scrapeAll(startBrowser());
