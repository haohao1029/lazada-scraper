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
    let failedUrl = [];
    //opening browser & going to url
    let page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 }); //setting wider viewport to load all products
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log(`Navigating to ` + url);
    // Get last page number
    const lastPage = await page.evaluate(() => {
      paginationBtns = document.querySelectorAll(".ant-pagination-item");
      return paginationBtns[paginationBtns.length - 1].innerText; // last page
    });
    console.log("start scraping");
    totalData = await this.scrapePage(page, browser, currentPage, lastPage, totalData);
    console.log(totalData)
    console.log("scraping done");
    console.log("import into files");

    fs.writeFile("items.json", JSON.stringify(totalData), (err) => {
      if (err) {
        throw err;
      }
    });
    fs.writeFile("failedUrl.json", JSON.stringify(failedUrl), (err) => {
      if (err) {
        throw err;
      }
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(totalData);
    xlsx.utils.book_append_sheet(wb, ws);
    xlsx.writeFile(wb, "items.xlsx");

    console.log("end program");
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
    const isCaptcha = await page.evaluate(() => {
      return document.getElementById("nocaptcha");
    });
    if (isCaptcha != null) {
      return true;
    }
    return false;
  },
  async getProductDetails(browser, page, totalData) {
    // waiter not exceed 10 pages
    console.log((await browser.pages()).length);
    while ((await browser.pages()).length >= 10) {
      await this.sleep(10000);
    }

    await page.goto(itemLink, { waitUntil: "networkidle0", timeout: 0 });

    while (await this.isCaptcha(page)) {
      console.log("captcha detected");
      await page.reload({ waitUntil: "networkidle0", timeout: 0 });
    }
    const dataItem = await page.evaluate(() => {
      let itemData = [];
      const title = document.querySelector(
        ".pdp-mod-product-badge-title"
      ).innerText;
      const rating = document
        .querySelector(".pdp-review-summary__link")
        .innerText.split(" ")[0];
      let price = document.querySelector(".pdp-price").innerText;
      let modelName = "";
      if (document.querySelector(".sku-name")) {
        modelName = document.querySelector(".sku-name").innerText;
      }
      data = {
        title,
        rating,
        price,
        modelName,
      };
      itemData.push(data);
      const modelBtns = document.querySelectorAll(".sku-variable-img-wrap");
      const modelLength = modelBtns.length;
      for (let i = 0; i < modelLength; i++) {
        const modelBtn = modelBtns[i];
        modelBtn.click();
        const modelName = document.querySelector(".sku-name").innerText;
        const price = document.querySelector(".pdp-price").innerText;
        data = {
          title,
          rating,
          price,
          modelName,
        };
        itemData.push(data);
      }
      return itemData;
    });
    page.close();
    totalData.push(...dataItem);
    return totalData;
  },
  async scrapePage(page, browser, currentPage, lastPage, totalData) {
    // start scrapping itemsssss
    for (currentPage = currentPage; currentPage <= lastPage; currentPage++) {
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
        console.log(`Navigating to ` + itemLink);
        try {
          this.getProductDetails(browser, itemPage, totalData);
          await this.sleep(5000);
        } catch (err) {
          failedUrl.push({
            itemLink,
          });
        }
      }
      await page.goto(
        `https://www.lazada.com.my/lucky-pharmacy-malaysia/?from=wangpu&langFlag=en&page=${currentPage}&pageTypeId=2&q=All-Products`,
        { waitUntil: "domcontentloaded" }
      );
    }
    return totalData;
  },
};

scrapeAll(startBrowser());
