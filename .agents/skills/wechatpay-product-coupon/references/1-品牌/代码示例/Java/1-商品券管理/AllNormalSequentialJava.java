package com.java.demo;

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/brand_models_and_client.java
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import com.java.utils.WXPayBrandUtility; // 引用微信支付工具库
import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;
import java.util.ArrayList;
import java.util.List;

/**
 * 创建商品券 - 多次优惠-全场-满减券
 * usage_mode=PROGRESSIVE_BUNDLE, scope=ALL, type=NORMAL
 */
public class AllNormalSequentialJava {

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数
    AllNormalSequentialJava client = new AllNormalSequentialJava(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考品牌经营平台【安全中心】
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考品牌经营平台【安全中心】
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    CreateProductCouponRequest request = new CreateProductCouponRequest();
    request.outRequestNo = "PROGRESSIVE_BUNDLE_ALL_NORMAL_20250101_002"; // 必填，创建请求单号，6-40个字符
    request.scope = ProductCouponScope.ALL; // 必填，优惠范围：ALL-全场券
    request.type = ProductCouponType.NORMAL; // 必填，商品券类型：NORMAL-满减券
    request.usageMode = UsageMode.PROGRESSIVE_BUNDLE; // 必填，使用模式：PROGRESSIVE_BUNDLE-多次优惠
    // 必填，多次优惠模式信息(当usage_mode=PROGRESSIVE_BUNDLE时必填)
    request.progressiveBundleUsageInfo = new ProgressiveBundleUsageInfo();
    request.progressiveBundleUsageInfo.count = 5L; // 必填，可使用次数，最少3次，最多15次
    request.progressiveBundleUsageInfo.intervalDays = 1L; // 选填，每次优惠间隔天数，最少0天（不限制），最多7天
    // 必填，商品券展示信息
    request.displayInfo = new ProductCouponDisplayInfo();
    request.displayInfo.name = "全场满减券-5次递增优惠"; // 必填，商品券名称，最多12个字符
    request.displayInfo.imageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"; // 必填，商品券图片URL
    request.displayInfo.backgroundUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"; // 选填，背景图URL
    request.displayInfo.detailImageUrlList = new ArrayList<>(); // 选填，详情图URL列表，最多6张
    {
      request.displayInfo.detailImageUrlList.add("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx");
    };
    request.outProductNo = "Product_ProgressiveBundle_002"; // 选填，商户侧商品券唯一标识
    // 必填，批次信息
    request.stockBundle = new StockForCreate();
    request.stockBundle.remark = "全场满减券批次"; // 选填，批次备注，最多60个字符
    request.stockBundle.couponCodeMode = CouponCodeMode.WECHATPAY; // 必填，券码模式：WECHATPAY/UPLOAD/API_ASSIGN
    // 必填，批次发放规则
    request.stockBundle.stockSendRule = new StockSendRule();
    request.stockBundle.stockSendRule.maxCount = 10000000L; // 必填，批次最大发放数量
    request.stockBundle.stockSendRule.maxCountPerDay = 100000L; // 选填，单日最大发放数量
    request.stockBundle.stockSendRule.maxCountPerUser = 1L; // 必填，单用户最大领取数量
    // 必填，多次优惠使用规则(当usage_mode=PROGRESSIVE_BUNDLE时必填)
    request.stockBundle.progressiveBundleUsageRule = new ProgressiveBundleUsageRule();
    // 必填，券可核销时间
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod = new CouponAvailablePeriod();
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.availableBeginTime = "2025-08-01T00:00:00+08:00"; // 必填，可用开始时间(RFC3339格式)
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.availableEndTime = "2025-12-31T23:59:59+08:00"; // 必填，可用结束时间(RFC3339格式)
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.availableDays = 30L; // 选填，多次优惠有效天数，最少3天，最多365天
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.waitDaysAfterReceive = 0L; // 选填，领取后N天生效，最少0天，最多30天
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.intervalDays = 1L; // 选填，使用间隔天数，最少0天，最多7天
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod = new FixedWeekPeriod(); // 选填，每周固定可用时间
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList = new ArrayList<>(); // 条件必填，每周可用星期数
    {
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.MONDAY);
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.TUESDAY);
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.WEDNESDAY);
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.THURSDAY);
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.FRIDAY);
    };
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.irregularAvailablePeriodList = new ArrayList<>(); // 选填，不规则可用时间段列表
    {
      TimePeriod period = new TimePeriod();
      period.beginTime = "2025-10-01T00:00:00+08:00"; // 必填，开始时间(RFC3339格式)
      period.endTime = "2025-10-07T23:59:59+08:00"; // 必填，结束时间(RFC3339格式)
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.irregularAvailablePeriodList.add(period);
    };
    request.stockBundle.progressiveBundleUsageRule.specialFirst = false; // 选填，首次优惠是否特殊
    // 条件必填，满减券使用规则列表(当type=NORMAL时必填，数量需与count一致)
    request.stockBundle.progressiveBundleUsageRule.normalCouponList = new ArrayList<>();
    {
      NormalCouponUsageRule rule1 = new NormalCouponUsageRule();
      rule1.threshold = 10000L; // 必填，门槛金额(单位：分)
      rule1.discountAmount = 1000L; // 必填，固定减免金额(单位：分)
      request.stockBundle.progressiveBundleUsageRule.normalCouponList.add(rule1);
      NormalCouponUsageRule rule2 = new NormalCouponUsageRule();
      rule2.threshold = 10000L;
      rule2.discountAmount = 1500L;
      request.stockBundle.progressiveBundleUsageRule.normalCouponList.add(rule2);
      NormalCouponUsageRule rule3 = new NormalCouponUsageRule();
      rule3.threshold = 10000L;
      rule3.discountAmount = 2000L;
      request.stockBundle.progressiveBundleUsageRule.normalCouponList.add(rule3);
      NormalCouponUsageRule rule4 = new NormalCouponUsageRule();
      rule4.threshold = 10000L;
      rule4.discountAmount = 2500L;
      request.stockBundle.progressiveBundleUsageRule.normalCouponList.add(rule4);
      NormalCouponUsageRule rule5 = new NormalCouponUsageRule();
      rule5.threshold = 10000L;
      rule5.discountAmount = 3000L;
      request.stockBundle.progressiveBundleUsageRule.normalCouponList.add(rule5);
    };
    // 必填，使用规则展示信息
    request.stockBundle.usageRuleDisplayInfo = new UsageRuleDisplayInfo();
    request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList = new ArrayList<>(); // 必填，核销方式列表
    {
      request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.OFFLINE); // 线下核销
      request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.MINI_PROGRAM); // 小程序核销
      request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.APP); // APP核销
      request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.PAYMENT_CODE); // 付款码核销
    };
    request.stockBundle.usageRuleDisplayInfo.miniProgramAppid = "wx1234567890"; // 条件必填，支持小程序核销时必填
    request.stockBundle.usageRuleDisplayInfo.miniProgramPath = "/pages/index/product"; // 条件必填，支持小程序核销时必填
    request.stockBundle.usageRuleDisplayInfo.appPath = "pages/index/product"; // 条件必填，支持APP核销时必填
    request.stockBundle.usageRuleDisplayInfo.usageDescription = "全场可用，多次递增满减"; // 选填，使用说明
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo = new CouponAvailableStoreInfo(); // 选填，可用门店信息
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo.description = "所有门店可用"; // 选填，可用门店描述
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramAppid = "wx1234567890"; // 选填，门店小程序AppID
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramPath = "/pages/index/store-list"; // 选填，门店小程序路径
    // 必填，用户券展示信息
    request.stockBundle.couponDisplayInfo = new CouponDisplayInfo();
    request.stockBundle.couponDisplayInfo.codeDisplayMode = CouponCodeDisplayMode.QRCODE; // 必填，券码展示模式：INVISIBLE/BARCODE/QRCODE
    request.stockBundle.couponDisplayInfo.backgroundColor = "Color010"; // 选填，背景颜色
    request.stockBundle.couponDisplayInfo.entranceMiniProgram = new EntranceMiniProgram(); // 选填，小程序入口
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.appid = "wx1234567890"; // 必填，小程序AppID
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.path = "/pages/index/product"; // 必填，小程序路径
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.entranceWording = "立即使用"; // 必填，入口文案
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.guidanceWording = "多次满减等你来"; // 选填，引导文案
    request.stockBundle.couponDisplayInfo.entranceOfficialAccount = new EntranceOfficialAccount(); // 选填，公众号入口
    request.stockBundle.couponDisplayInfo.entranceOfficialAccount.appid = "wx1234567890"; // 必填，公众号AppID
    request.stockBundle.couponDisplayInfo.entranceFinder = new EntranceFinder(); // 选填，视频号入口
    request.stockBundle.couponDisplayInfo.entranceFinder.finderId = "gh_12345678"; // 必填，视频号ID
    request.stockBundle.couponDisplayInfo.entranceFinder.finderVideoId = "UDFsdf24df34dD456Hdf34"; // 选填，视频号视频ID
    request.stockBundle.couponDisplayInfo.entranceFinder.finderVideoCoverImageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"; // 选填，视频封面图URL
    request.stockBundle.notifyConfig = new NotifyConfig(); // 选填，事件通知配置
    request.stockBundle.notifyConfig.notifyAppid = "wx4fd12345678"; // 必填，通知AppID
    request.stockBundle.storeScope = StockStoreScope.NONE; // 必填，门店适用范围：NONE-不限制/ALL-全部门店/SPECIFIC-指定门店

    try {
      CreateProductCouponResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }
}
