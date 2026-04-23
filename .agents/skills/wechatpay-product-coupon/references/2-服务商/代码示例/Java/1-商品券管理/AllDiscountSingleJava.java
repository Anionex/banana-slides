package com.java.demo;

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/ServiceModelsAndClient.java
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import com.java.utils.WXPayUtility; // 引用微信支付工具库
import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;

import java.util.ArrayList;
import java.util.List;

/**
 * 场景1：创建商品券 - 单券-全场-折扣券
 * 
 * 场景说明：
 * - usage_mode: SINGLE（单券模式）
 * - scope: ALL（全场券）
 * - type: DISCOUNT（折扣券）
 * 
 * 优惠规则配置位置：single_usage_info.discount_coupon（全场券在single_usage_info中配置）
 */
public class AllDiscountSingleJava {

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数
    AllDiscountSingleJava client = new AllDiscountSingleJava(
      "19xxxxxxxx",                    // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考商户平台
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号，如何获取请参考商户平台【API安全】
      "/path/to/apiclient_key.pem",    // 商户API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考商户平台【API安全】
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    CreateProductCouponRequest request = new CreateProductCouponRequest();
    // 必填，创建请求单号，6-40个字符，品牌侧需保持唯一性
    request.outRequestNo = "SINGLE_ALL_DISCOUNT_20250101_001";
    // 必填，品牌ID，由微信支付分配
    request.brandId = "120344";
    // 必填，优惠范围：ALL-全场券(仅支持NORMAL/DISCOUNT), SINGLE-单品券(支持NORMAL/DISCOUNT/EXCHANGE)
    request.scope = ProductCouponScope.ALL;
    // 必填，商品券类型：NORMAL-满减券, DISCOUNT-折扣券, EXCHANGE-兑换券(仅单品券)
    request.type = ProductCouponType.DISCOUNT;
    // 必填，使用模式：SINGLE-单券, PROGRESSIVE_BUNDLE-多次优惠
    request.usageMode = UsageMode.SINGLE;
    // 选填，商户侧商品券唯一标识
    request.outProductNo = "Product_SINGLE_001";

    // 条件必填，单券模式优惠信息(当usage_mode=SINGLE且scope=ALL时选填，配置优惠规则)
    request.singleUsageInfo = new SingleUsageInfo();
    // 条件必填，折扣券使用规则(当type=DISCOUNT且scope=ALL时必填)
    request.singleUsageInfo.discountCoupon = new DiscountCouponUsageRule();
    // 必填，门槛金额(单位：分)，0表示无门槛
    request.singleUsageInfo.discountCoupon.threshold = 10000L;
    // 必填，折扣百分比，20表示减免20%即打8折
    request.singleUsageInfo.discountCoupon.percentOff = 20L;

    // 必填，商品券展示信息
    request.displayInfo = new ProductCouponDisplayInfo();
    // 必填，商品券名称，最多12个字符
    request.displayInfo.name = "全场满100立打8折";
    // 必填，商品券图片URL
    request.displayInfo.imageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    // 选填，背景图URL
    request.displayInfo.backgroundUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    // 选填，详情图URL列表，最多6张
    request.displayInfo.detailImageUrlList = new ArrayList<>();
    {
      request.displayInfo.detailImageUrlList.add("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx");
    };

    // 条件必填，批次信息(当usage_mode=SINGLE时必填)
    request.stock = new StockForCreate();
    request.stock.remark = "8月工作日有效批次";
    request.stock.couponCodeMode = CouponCodeMode.WECHATPAY;
    request.stock.stockSendRule = new StockSendRule();
    request.stock.stockSendRule.maxCount = 10000000L;
    request.stock.stockSendRule.maxCountPerDay = 100000L;
    request.stock.stockSendRule.maxCountPerUser = 1L;

    // 单券使用规则（scope=ALL时只配置券可核销时间，优惠规则在single_usage_info中）
    request.stock.singleUsageRule = new SingleUsageRule();
    request.stock.singleUsageRule.couponAvailablePeriod = new CouponAvailablePeriod();
    request.stock.singleUsageRule.couponAvailablePeriod.availableBeginTime = "2025-08-01T00:00:00+08:00";
    request.stock.singleUsageRule.couponAvailablePeriod.availableEndTime = "2025-08-31T23:59:59+08:00";
    request.stock.singleUsageRule.couponAvailablePeriod.availableDays = 30L;
    request.stock.singleUsageRule.couponAvailablePeriod.waitDaysAfterReceive = 0L;
    request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod = new FixedWeekPeriod();
    request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList = new ArrayList<>();
    {
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.MONDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.TUESDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.WEDNESDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.THURSDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.FRIDAY);
    };

    // 使用规则展示信息
    request.stock.usageRuleDisplayInfo = new UsageRuleDisplayInfo();
    request.stock.usageRuleDisplayInfo.couponUsageMethodList = new ArrayList<>();
    {
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.OFFLINE);
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.MINI_PROGRAM);
      request.stock.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.PAYMENT_CODE);
    };
    request.stock.usageRuleDisplayInfo.miniProgramAppid = "wx1234567890";
    request.stock.usageRuleDisplayInfo.miniProgramPath = "/pages/index/product";
    request.stock.usageRuleDisplayInfo.usageDescription = "工作日可用";
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo = new CouponAvailableStoreInfo();
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo.description = "所有门店可用，可使用小程序查看门店列表";
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramAppid = "wx1234567890";
    request.stock.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramPath = "/pages/index/store-list";

    // 用户券展示信息
    request.stock.couponDisplayInfo = new CouponDisplayInfo();
    request.stock.couponDisplayInfo.codeDisplayMode = CouponCodeDisplayMode.QRCODE;
    request.stock.couponDisplayInfo.backgroundColor = "Color010";
    request.stock.couponDisplayInfo.entranceMiniProgram = new EntranceMiniProgram();
    request.stock.couponDisplayInfo.entranceMiniProgram.appid = "wx1234567890";
    request.stock.couponDisplayInfo.entranceMiniProgram.path = "/pages/index/product";
    request.stock.couponDisplayInfo.entranceMiniProgram.entranceWording = "欢迎选购";
    request.stock.couponDisplayInfo.entranceMiniProgram.guidanceWording = "获取更多优惠";
    request.stock.couponDisplayInfo.entranceOfficialAccount = new EntranceOfficialAccount();
    request.stock.couponDisplayInfo.entranceOfficialAccount.appid = "wx1234567890";
    request.stock.couponDisplayInfo.entranceFinder = new EntranceFinder();
    request.stock.couponDisplayInfo.entranceFinder.finderId = "gh_12345678";
    request.stock.couponDisplayInfo.entranceFinder.finderVideoId = "UDFsdf24df34dD456Hdf34";
    request.stock.couponDisplayInfo.entranceFinder.finderVideoCoverImageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";

    // 事件通知配置
    request.stock.notifyConfig = new NotifyConfig();
    request.stock.notifyConfig.notifyAppid = "wx4fd12345678";
    request.stock.storeScope = StockStoreScope.NONE;

    try {
      CreateProductCouponResponse response = client.run(request);
      // TODO: 请求成功，继续业务逻辑
      System.out.println(response);
    } catch (WXPayUtility.ApiException e) {
      // TODO: 请求失败，根据状态码执行不同的逻辑
      e.printStackTrace();
    }
  }
}
