package com.wechat.pay.java.core.test.productCoupon;

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/brand_models_and_client.java
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import com.java.utils.WXPayBrandUtility; // 引用微信支付工具库

import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;

import java.util.ArrayList;
import java.util.List;

/**
 * 创建商品券 - 单券-单品-折扣券
 */
public class SingleDiscountJava {

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数
    SingleDiscountJava client = new SingleDiscountJava(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考品牌经营平台【安全中心】
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考品牌经营平台【安全中心】
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    CreateProductCouponRequest request = new CreateProductCouponRequest();
    request.outRequestNo = "12345_20250101_A3489"; // 必填，创建请求单号，6-40个字符
    request.scope = ProductCouponScope.SINGLE; // 必填，优惠范围：SINGLE-单品券
    request.type = ProductCouponType.DISCOUNT; // 必填，商品券类型：DISCOUNT-折扣券
    request.usageMode = UsageMode.SINGLE; // 必填，使用模式：SINGLE-单券
    // 必填，商品券展示信息
    request.displayInfo = new ProductCouponDisplayInfo();
    request.displayInfo.name = "特定商品9折券"; // 必填，商品券名称，最多12个字符
    request.displayInfo.imageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"; // 必填，商品券图片URL
    request.displayInfo.backgroundUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"; // 选填，背景图URL
    request.displayInfo.detailImageUrlList = new ArrayList<>(); // 选填，详情图URL列表，最多6张
    {
      request.displayInfo.detailImageUrlList.add("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx");
    };
    request.displayInfo.originalPrice = 15000L; // 必填(单品券)，商品原价(单位：分)
    request.displayInfo.comboPackageList = new ArrayList<>(); // 必填(单品券)，套餐组合列表
    {
      ComboPackage comboPackage = new ComboPackage();
      comboPackage.name = "超值套餐"; // 必填，套餐名称
      comboPackage.pickCount = 3L; // 必填，可选商品数量
      comboPackage.choiceList = new ArrayList<>(); // 必填，可选商品列表
      ComboPackageChoice choice = new ComboPackageChoice();
      choice.name = "可乐"; // 必填，商品名称
      choice.price = 500L; // 必填，商品价格(单位：分)
      choice.count = 1L; // 必填，商品数量
      choice.imageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"; // 必填，商品图片URL
      choice.miniProgramAppid = "wx1234567890"; // 选填，跳转小程序AppID
      choice.miniProgramPath = "/pages/index/product"; // 选填，跳转小程序路径
      comboPackage.choiceList.add(choice);
      request.displayInfo.comboPackageList.add(comboPackage);
    };
    request.outProductNo = "Product_1234567890"; // 选填，商户侧商品券唯一标识
    // 条件必填，批次信息(当usage_mode=SINGLE时必填)
    request.stock = new StockForCreate();
    request.stock.remark = "8月工作日有效批次"; // 选填，批次备注，最多60个字符
    request.stock.couponCodeMode = CouponCodeMode.UPLOAD; // 必填，券码模式：WECHATPAY/UPLOAD/API_ASSIGN
    // 必填，批次发放规则
    request.stock.stockSendRule = new StockSendRule();
    request.stock.stockSendRule.maxCount = 10000000L; // 必填，批次最大发放数量
    request.stock.stockSendRule.maxCountPerDay = 100000L; // 选填，单日最大发放数量
    request.stock.stockSendRule.maxCountPerUser = 1L; // 必填，单用户最大领取数量
    // 条件必填，单券使用规则(当usage_mode=SINGLE时必填)
    request.stock.singleUsageRule = new SingleUsageRule();
    // 必填，券可核销时间
    request.stock.singleUsageRule.couponAvailablePeriod = new SingleCouponAvailablePeriod();
    request.stock.singleUsageRule.couponAvailablePeriod.availableBeginTime = "2025-08-01T00:00:00+08:00"; // 必填，可用开始时间(RFC3339格式)
    request.stock.singleUsageRule.couponAvailablePeriod.availableEndTime = "2025-08-31T23:59:59+08:00"; // 必填，可用结束时间(RFC3339格式)
    request.stock.singleUsageRule.couponAvailablePeriod.availableDays = 30L; // 选填，领取后有效天数
    request.stock.singleUsageRule.couponAvailablePeriod.waitDaysAfterReceive = 0L; // 选填，领取后等待天数
    request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod = new FixedWeekPeriod(); // 选填，每周固定可用时间
    request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList = new ArrayList<>(); // 条件必填，每周可用星期数
    {
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.MONDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.TUESDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.WEDNESDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.THURSDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.FRIDAY);
    };
    request.stock.singleUsageRule.couponAvailablePeriod.irregularAvailablePeriodList = new ArrayList<>(); // 选填，不规则可用时间段列表
    {
      TimePeriod irregularPeriod = new TimePeriod();
      irregularPeriod.beginTime = "2025-08-15T00:00:00+08:00"; // 必填，开始时间(RFC3339格式)
      irregularPeriod.endTime = "2025-08-15T23:59:59+08:00"; // 必填，结束时间(RFC3339格式)
      request.stock.singleUsageRule.couponAvailablePeriod.irregularAvailablePeriodList.add(irregularPeriod);
    };
    // 条件必填，折扣券使用规则(单品券的优惠规则在批次中配置，当type=DISCOUNT且scope=SINGLE时必填)
    request.stock.singleUsageRule.discountCoupon = new DiscountCouponUsageRule();
    request.stock.singleUsageRule.discountCoupon.threshold = 0L; // 必填，门槛金额(单位：分)，0表示无门槛
    request.stock.singleUsageRule.discountCoupon.percentOff = 10L; // 必填，折扣百分比，10表示打9折
    // 必填，使用规则展示信息
    request.stock.usageRuleDisplayInfo = new UsageRuleDisplayInfo();
    request.stock.usageRuleDisplayInfo.couponUsageMethodList = new ArrayList<>(); // 必填，核销方式列表
    {
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.OFFLINE); // 线下核销
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.MINI_PROGRAM); // 小程序核销
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.APP); // APP核销
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.PAYMENT_CODE); // 付款码核销
    };
    request.stock.usageRuleDisplayInfo.miniProgramAppid = "wx1234567890"; // 条件必填，支持小程序核销时必填
    request.stock.usageRuleDisplayInfo.miniProgramPath = "/pages/index/product"; // 条件必填，支持小程序核销时必填
    request.stock.usageRuleDisplayInfo.appPath = "pages/index/product"; // 条件必填，支持APP核销时必填
    request.stock.usageRuleDisplayInfo.usageDescription = "工作日可用"; // 选填，使用说明
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo = new CouponAvailableStoreInfo(); // 选填，可用门店信息
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo.description = "所有门店可用，可使用小程序查看门店列表"; // 选填，可用门店描述
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramAppid = "wx1234567890"; // 选填，门店小程序AppID
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramPath = "/pages/index/store-list"; // 选填，门店小程序路径
    // 必填，用户券展示信息
    request.stock.couponDisplayInfo = new CouponDisplayInfo();
    request.stock.couponDisplayInfo.codeDisplayMode = CouponCodeDisplayMode.QRCODE; // 必填，券码展示模式：INVISIBLE/BARCODE/QRCODE
    request.stock.couponDisplayInfo.backgroundColor = "Color010"; // 选填，背景颜色
    request.stock.couponDisplayInfo.entranceMiniProgram = new EntranceMiniProgram(); // 选填，小程序入口
    request.stock.couponDisplayInfo.entranceMiniProgram.appid = "wx1234567890"; // 必填，小程序AppID
    request.stock.couponDisplayInfo.entranceMiniProgram.path = "/pages/index/product"; // 必填，小程序路径
    request.stock.couponDisplayInfo.entranceMiniProgram.entranceWording = "欢迎选购"; // 必填，入口文案
    request.stock.couponDisplayInfo.entranceMiniProgram.guidanceWording = "获取更多优惠"; // 选填，引导文案
    request.stock.couponDisplayInfo.entranceOfficialAccount = new EntranceOfficialAccount(); // 选填，公众号入口
    request.stock.couponDisplayInfo.entranceOfficialAccount.appid = "wx1234567890"; // 必填，公众号AppID
    request.stock.couponDisplayInfo.entranceFinder = new EntranceFinder(); // 选填，视频号入口
    request.stock.couponDisplayInfo.entranceFinder.finderId = "gh_12345678";
    request.stock.couponDisplayInfo.entranceFinder.finderVideoId = "UDFsdf24df34dD456Hdf34";
    request.stock.couponDisplayInfo.entranceFinder.finderVideoCoverImageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    request.stock.notifyConfig = new NotifyConfig();
    request.stock.notifyConfig.notifyAppid = "wx4fd12345678";
    request.stock.storeScope = StockStoreScope.NONE;
    try {
      CreateProductCouponResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println("单品折扣券创建成功: " + response.productCouponId);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }
}
