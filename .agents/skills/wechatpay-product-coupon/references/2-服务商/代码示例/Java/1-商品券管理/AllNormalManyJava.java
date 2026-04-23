package com.java.demo;

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/ServiceModelsAndClient.java
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import com.java.utils.WXPayUtility; // 引用微信支付工具库
import com.google.gson.annotations.SerializedName;
import java.util.ArrayList;
import java.util.List;

/**
 * 创建商品券 - 场景2：多次优惠-全场-满减券
 * 
 * 场景说明：全场券（适用于全部商品）+ 满减券（满足门槛后减固定金额）+ 阶梯模式（可多次使用）
 * 
 * 关键参数：
 * - scope = ALL（全场券）
 * - type = NORMAL（满减券）
 * - usage_mode = PROGRESSIVE_BUNDLE（阶梯模式）
 */
public class AllNormalManyJava {

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数
    AllNormalManyJava client = new AllNormalManyJava(
      "19xxxxxxxx",                    // 商户号
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号
      "/path/to/apiclient_key.pem",    // 商户API证书私钥文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径
    );

    CreateProductCouponRequest request = new CreateProductCouponRequest();
    // 必填，创建请求单号，6-40个字符，品牌侧需保持唯一性
    request.outRequestNo = "MANY_ALL_NORMAL_20250101_002";
    // 必填，品牌ID，由微信支付分配
    request.brandId = "120344";
    // 选填，商户侧商品券唯一标识
    request.outProductNo = "Product_1234567890";
    // 必填，优惠范围：ALL-全场券(仅支持NORMAL/DISCOUNT), SINGLE-单品券(支持NORMAL/DISCOUNT/EXCHANGE)
    request.scope = ProductCouponScope.ALL;
    // 必填，商品券类型：NORMAL-满减券, DISCOUNT-折扣券, EXCHANGE-兑换券(仅单品券)
    request.type = ProductCouponType.NORMAL;
    // 必填，使用模式：SINGLE-单券, PROGRESSIVE_BUNDLE-多次优惠
    request.usageMode = UsageMode.PROGRESSIVE_BUNDLE;

    // 条件必填，多次优惠模式配置信息(当usage_mode=PROGRESSIVE_BUNDLE时必填)
    request.progressiveBundleUsageInfo = new ProgressiveBundleUsageInfo();
    // 必填，可使用次数，最少3次，最多15次
    request.progressiveBundleUsageInfo.count = 3L;
    // 选填，多次优惠使用间隔天数(1表示使用后次日00:00:00才能使用下一次)，最高7天，默认0
    request.progressiveBundleUsageInfo.intervalDays = 1L;  // 使用后次日00:00:00才能使用下一次

    // 必填，商品券展示信息
    request.displayInfo = new ProductCouponDisplayInfo();
    // 必填，商品券名称，最多12个字符
    request.displayInfo.name = "全场满100减15(可用3次)";
    // 必填，商品券图片URL
    request.displayInfo.imageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    // 选填，背景图URL
    request.displayInfo.backgroundUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    // 选填，详情图URL列表，最多6张
    request.displayInfo.detailImageUrlList = new ArrayList<>();
    request.displayInfo.detailImageUrlList.add("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx");

    // 条件必填，批次信息(当usage_mode=PROGRESSIVE_BUNDLE时必填)
    request.stockBundle = createStock("满100减15批次", 10000, 1500);

    try {
      CreateProductCouponResponse response = client.run(request);
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      e.printStackTrace();
    }
  }

  /**
   * 创建满减券批次
   */
  private static StockForProgressiveBundle createStock(String remark, long threshold, long discountAmount) {
    StockForProgressiveBundle stock = new StockForProgressiveBundle();
    stock.remark = remark;
    stock.couponCodeMode = CouponCodeMode.WECHATPAY;

    stock.stockSendRule = new StockSendRule();
    stock.stockSendRule.maxCount = 10000000L;
    stock.stockSendRule.maxCountPerUser = 1L;

    stock.progressiveBundleUsageRule = new ProgressiveBundleUsageRule();
    stock.progressiveBundleUsageRule.couponAvailablePeriod = new CouponAvailablePeriod();
    stock.progressiveBundleUsageRule.couponAvailablePeriod.availableBeginTime = "2025-08-01T00:00:00+08:00";
    stock.progressiveBundleUsageRule.couponAvailablePeriod.availableEndTime = "2025-08-31T23:59:59+08:00";
    stock.progressiveBundleUsageRule.couponAvailablePeriod.availableDays = 30L;
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod = new FixedWeekPeriod();
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList = new ArrayList<>();
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.MONDAY);
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.TUESDAY);
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.WEDNESDAY);
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.THURSDAY);
    stock.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.FRIDAY);

    // 满减券规则
    stock.progressiveBundleUsageRule.normalCoupon = new NormalCouponUsageRule();
    stock.progressiveBundleUsageRule.normalCoupon.threshold = threshold;
    stock.progressiveBundleUsageRule.normalCoupon.discountAmount = discountAmount;

    stock.usageRuleDisplayInfo = new UsageRuleDisplayInfo();
    stock.usageRuleDisplayInfo.couponUsageMethodList = new ArrayList<>();
    stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.OFFLINE);
    stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.MINI_PROGRAM);
    stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.PAYMENT_CODE);
    stock.usageRuleDisplayInfo.miniProgramAppid = "wx1234567890";
    stock.usageRuleDisplayInfo.miniProgramPath = "/pages/index/product";
    stock.usageRuleDisplayInfo.usageDescription = "工作日可用";
    stock.usageRuleDisplayInfo.couponAvailableStoreInfo = new CouponAvailableStoreInfo();
    stock.usageRuleDisplayInfo.couponAvailableStoreInfo.description = "所有门店可用，可使用小程序查看门店列表";
    stock.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramAppid = "wx1234567890";
    stock.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramPath = "/pages/index/store-list";

    stock.couponDisplayInfo = new CouponDisplayInfo();
    stock.couponDisplayInfo.codeDisplayMode = CouponCodeDisplayMode.QRCODE;
    stock.couponDisplayInfo.backgroundColor = "Color010";
    stock.couponDisplayInfo.entranceMiniProgram = new EntranceMiniProgram();
    stock.couponDisplayInfo.entranceMiniProgram.appid = "wx1234567890";
    stock.couponDisplayInfo.entranceMiniProgram.path = "/pages/index/product";
    stock.couponDisplayInfo.entranceMiniProgram.entranceWording = "欢迎选购";
    stock.couponDisplayInfo.entranceMiniProgram.guidanceWording = "获取更多优惠";
    stock.couponDisplayInfo.entranceOfficialAccount = new EntranceOfficialAccount();
    stock.couponDisplayInfo.entranceOfficialAccount.appid = "wx1234567890";
    stock.couponDisplayInfo.entranceFinder = new EntranceFinder();
    stock.couponDisplayInfo.entranceFinder.finderId = "gh_12345678";
    stock.couponDisplayInfo.entranceFinder.finderVideoId = "UDFsdf24df34dD456Hdf34";
    stock.couponDisplayInfo.entranceFinder.finderVideoCoverImageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";

    stock.storeScope = StockStoreScope.NONE;
    stock.notifyConfig = new NotifyConfig();
    stock.notifyConfig.notifyAppid = "wx4fd12345678";

    return stock;
  }
}
