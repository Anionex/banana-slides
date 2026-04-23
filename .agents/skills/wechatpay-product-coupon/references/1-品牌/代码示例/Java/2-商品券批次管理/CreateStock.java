// 【添加商品券批次接口】示例代码
// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/BrandModelsAndClient.java
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构
package com.java.demo;

import com.java.utils.WXPayBrandUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/brand/4015826861

import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 添加商品券批次
 */
public class CreateStock {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/brand/marketing/product-coupon/product-coupons/{product_coupon_id}/stocks";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
    CreateStock client = new CreateStock(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    CreateStockRequest request = new CreateStockRequest();
    request.outRequestNo = "12345_20250101_A3489";
    request.productCouponId = "1000000013";
    request.stock = new StockForCreate();
    request.stock.remark = "8月工作日有效批次";
    request.stock.couponCodeMode = CouponCodeMode.UPLOAD;
    request.stock.stockSendRule = new StockSendRule();
    request.stock.stockSendRule.maxCount = 10000000L;
    request.stock.stockSendRule.maxCountPerUser = 1L;
    request.stock.singleUsageRule = new SingleUsageRule();
    request.stock.singleUsageRule.couponAvailablePeriod = new CouponAvailablePeriod();
    request.stock.singleUsageRule.couponAvailablePeriod.availableBeginTime = "2025-08-01T00:00:00+08:00";
    request.stock.singleUsageRule.couponAvailablePeriod.availableEndTime = "2025-08-31T23:59:59+08:00";
    request.stock.singleUsageRule.couponAvailablePeriod.availableDays = 30L;
    request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod = new FixedWeekPeriod();
    request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList = new ArrayList<>();
    {
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.MONDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.TUESDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.WEDNESDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.THURSDAY);
      request.stock.singleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.FRIDAY);
    };
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
    request.stock.notifyConfig = new NotifyConfig();
    request.stock.notifyConfig.notifyAppid = "wx4fd12345678";
    request.stock.storeScope = StockStoreScope.NONE;
    try {
      StockEntity response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public StockEntity run(CreateStockRequest request) {
    String uri = PATH;
    uri = uri.replace("{product_coupon_id}", WXPayBrandUtility.urlEncode(request.productCouponId));
    String reqBody = WXPayBrandUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayBrandUtility.buildAuthorization(brand_id, certificateSerialNo,privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayBrandUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayBrandUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayBrandUtility.fromJson(respBody, StockEntity.class);
      } else {
        throw new WXPayBrandUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
    }
  }

  private final String brand_id;
  private final String certificateSerialNo;
  private final PrivateKey privateKey;
  private final String wechatPayPublicKeyId;
  private final PublicKey wechatPayPublicKey;

  public CreateStock(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class CreateStockRequest {
    @SerializedName("out_request_no")
    public String outRequestNo;
  
    @SerializedName("product_coupon_id")
    @Expose(serialize = false)
    public String productCouponId;
  
    @SerializedName("stock")
    public StockForCreate stock;
  }
  
  public static class StockEntity {
    @SerializedName("product_coupon_id")
    public String productCouponId;
  
    @SerializedName("stock_id")
    public String stockId;
  
    @SerializedName("remark")
    public String remark;
  
    @SerializedName("coupon_code_mode")
    public CouponCodeMode couponCodeMode;
  
    @SerializedName("coupon_code_count_info")
    public CouponCodeCountInfo couponCodeCountInfo;
  
    @SerializedName("stock_send_rule")
    public StockSendRule stockSendRule;
  
    @SerializedName("single_usage_rule")
    public SingleUsageRule singleUsageRule;
  
    @SerializedName("usage_rule_display_info")
    public UsageRuleDisplayInfo usageRuleDisplayInfo;
  
    @SerializedName("coupon_display_info")
    public CouponDisplayInfo couponDisplayInfo;
  
    @SerializedName("notify_config")
    public NotifyConfig notifyConfig;
  
    @SerializedName("store_scope")
    public StockStoreScope storeScope;
  
    @SerializedName("sent_count_info")
    public StockSentCountInfo sentCountInfo;
  
    @SerializedName("state")
    public StockState state;
  
    @SerializedName("deactivate_request_no")
    public String deactivateRequestNo;
  
    @SerializedName("deactivate_time")
    public String deactivateTime;
  
    @SerializedName("deactivate_reason")
    public String deactivateReason;
  }
  
  public static class StockForCreate {
    @SerializedName("remark")
    public String remark;
  
    @SerializedName("coupon_code_mode")
    public CouponCodeMode couponCodeMode;
  
    @SerializedName("stock_send_rule")
    public StockSendRule stockSendRule;
  
    @SerializedName("single_usage_rule")
    public SingleUsageRule singleUsageRule;
  
    @SerializedName("usage_rule_display_info")
    public UsageRuleDisplayInfo usageRuleDisplayInfo;
  
    @SerializedName("coupon_display_info")
    public CouponDisplayInfo couponDisplayInfo;
  
    @SerializedName("notify_config")
    public NotifyConfig notifyConfig;
  
    @SerializedName("store_scope")
    public StockStoreScope storeScope;
  }
  
  public enum CouponCodeMode {
    @SerializedName("WECHATPAY")
    WECHATPAY,
    @SerializedName("UPLOAD")
    UPLOAD,
    @SerializedName("API_ASSIGN")
    API_ASSIGN
  }
  
  public static class CouponCodeCountInfo {
    @SerializedName("total_count")
    public Long totalCount;
  
    @SerializedName("available_count")
    public Long availableCount;
  }
  
  public static class StockSendRule {
    @SerializedName("max_count")
    public Long maxCount;
  
    @SerializedName("max_count_per_day")
    public Long maxCountPerDay;
  
    @SerializedName("max_count_per_user")
    public Long maxCountPerUser;
  }
  
  public static class SingleUsageRule {
    @SerializedName("coupon_available_period")
    public CouponAvailablePeriod couponAvailablePeriod;
  
    @SerializedName("normal_coupon")
    public NormalCouponUsageRule normalCoupon;
  
    @SerializedName("discount_coupon")
    public DiscountCouponUsageRule discountCoupon;
  
    @SerializedName("exchange_coupon")
    public ExchangeCouponUsageRule exchangeCoupon;
  }
  
  public static class UsageRuleDisplayInfo {
    @SerializedName("coupon_usage_method_list")
    public List<CouponUsageMethod> couponUsageMethodList = new ArrayList<CouponUsageMethod>();
  
    @SerializedName("mini_program_appid")
    public String miniProgramAppid;
  
    @SerializedName("mini_program_path")
    public String miniProgramPath;
  
    @SerializedName("app_path")
    public String appPath;
  
    @SerializedName("usage_description")
    public String usageDescription;
  
    @SerializedName("coupon_available_store_info")
    public CouponAvailableStoreInfo couponAvailableStoreInfo;
  }
  
  public static class CouponDisplayInfo {
    @SerializedName("code_display_mode")
    public CouponCodeDisplayMode codeDisplayMode;
  
    @SerializedName("background_color")
    public String backgroundColor;
  
    @SerializedName("entrance_mini_program")
    public EntranceMiniProgram entranceMiniProgram;
  
    @SerializedName("entrance_official_account")
    public EntranceOfficialAccount entranceOfficialAccount;
  
    @SerializedName("entrance_finder")
    public EntranceFinder entranceFinder;
  }
  
  public static class NotifyConfig {
    @SerializedName("notify_appid")
    public String notifyAppid;
  }
  
  public enum StockStoreScope {
    @SerializedName("NONE")
    NONE,
    @SerializedName("ALL")
    ALL,
    @SerializedName("SPECIFIC")
    SPECIFIC
  }
  
  public static class StockSentCountInfo {
    @SerializedName("total_count")
    public Long totalCount;
  
    @SerializedName("today_count")
    public Long todayCount;
  }
  
  public enum StockState {
    @SerializedName("AUDITING")
    AUDITING,
    @SerializedName("SENDING")
    SENDING,
    @SerializedName("PAUSED")
    PAUSED,
    @SerializedName("STOPPED")
    STOPPED,
    @SerializedName("DEACTIVATED")
    DEACTIVATED
  }
  
  public static class CouponAvailablePeriod {
    @SerializedName("available_begin_time")
    public String availableBeginTime;
  
    @SerializedName("available_end_time")
    public String availableEndTime;
  
    @SerializedName("available_days")
    public Long availableDays;
  
    @SerializedName("wait_days_after_receive")
    public Long waitDaysAfterReceive;
  
    @SerializedName("weekly_available_period")
    public FixedWeekPeriod weeklyAvailablePeriod;
  
    @SerializedName("irregular_available_period_list")
    public List<TimePeriod> irregularAvailablePeriodList;
  }
  
  public static class NormalCouponUsageRule {
    @SerializedName("threshold")
    public Long threshold;
  
    @SerializedName("discount_amount")
    public Long discountAmount;
  }
  
  public static class DiscountCouponUsageRule {
    @SerializedName("threshold")
    public Long threshold;
  
    @SerializedName("percent_off")
    public Long percentOff;
  }
  
  public static class ExchangeCouponUsageRule {
    @SerializedName("threshold")
    public Long threshold;
  
    @SerializedName("exchange_price")
    public Long exchangePrice;
  }
  
  public enum CouponUsageMethod {
    @SerializedName("OFFLINE")
    OFFLINE,
    @SerializedName("MINI_PROGRAM")
    MINI_PROGRAM,
    @SerializedName("APP")
    APP,
    @SerializedName("PAYMENT_CODE")
    PAYMENT_CODE
  }
  
  public static class CouponAvailableStoreInfo {
    @SerializedName("description")
    public String description;
  
    @SerializedName("mini_program_appid")
    public String miniProgramAppid;
  
    @SerializedName("mini_program_path")
    public String miniProgramPath;
  }
  
  public enum CouponCodeDisplayMode {
    @SerializedName("INVISIBLE")
    INVISIBLE,
    @SerializedName("BARCODE")
    BARCODE,
    @SerializedName("QRCODE")
    QRCODE
  }
  
  public static class EntranceMiniProgram {
    @SerializedName("appid")
    public String appid;
  
    @SerializedName("path")
    public String path;
  
    @SerializedName("entrance_wording")
    public String entranceWording;
  
    @SerializedName("guidance_wording")
    public String guidanceWording;
  }
  
  public static class EntranceOfficialAccount {
    @SerializedName("appid")
    public String appid;
  }
  
  public static class EntranceFinder {
    @SerializedName("finder_id")
    public String finderId;
  
    @SerializedName("finder_video_id")
    public String finderVideoId;
  
    @SerializedName("finder_video_cover_image_url")
    public String finderVideoCoverImageUrl;
  }
  
  public static class FixedWeekPeriod {
    @SerializedName("day_list")
    public List<WeekEnum> dayList;
  
    @SerializedName("day_period_list")
    public List<PeriodOfTheDay> dayPeriodList;
  }
  
  public static class TimePeriod {
    @SerializedName("begin_time")
    public String beginTime;
  
    @SerializedName("end_time")
    public String endTime;
  }
  
  public enum WeekEnum {
    @SerializedName("MONDAY")
    MONDAY,
    @SerializedName("TUESDAY")
    TUESDAY,
    @SerializedName("WEDNESDAY")
    WEDNESDAY,
    @SerializedName("THURSDAY")
    THURSDAY,
    @SerializedName("FRIDAY")
    FRIDAY,
    @SerializedName("SATURDAY")
    SATURDAY,
    @SerializedName("SUNDAY")
    SUNDAY
  }
  
  public static class PeriodOfTheDay {
    @SerializedName("begin_time")
    public Long beginTime;
  
    @SerializedName("end_time")
    public Long endTime;
  }
  
}
