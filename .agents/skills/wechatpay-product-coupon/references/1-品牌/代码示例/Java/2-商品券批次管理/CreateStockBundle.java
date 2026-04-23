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
 * 添加商品券批次组
 */
public class CreateStockBundle {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/brand/marketing/product-coupon/product-coupons/{product_coupon_id}/stock-bundles";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
    CreateStockBundle client = new CreateStockBundle(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    CreateStockBundleRequest request = new CreateStockBundleRequest();
    request.productCouponId = "200000001";
    request.outRequestNo = "34657_20250101_123456";
    request.stockBundle = new StockBundleForCreate();
    request.stockBundle.remark = "满减券";
    request.stockBundle.couponCodeMode = CouponCodeMode.UPLOAD;
    request.stockBundle.stockSendRule = new StockSendRuleForBundle();
    request.stockBundle.stockSendRule.maxCount = 10000000L;
    request.stockBundle.stockSendRule.maxCountPerDay = 10000L;
    request.stockBundle.stockSendRule.maxCountPerUser = 1L;
    request.stockBundle.progressiveBundleUsageRule = new StockBundleUsageRule();
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod = new CouponAvailablePeriod();
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.availableBeginTime = "2025-01-01T00:00:00+08:00";
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.availableEndTime = "2025-10-01T00:00:00+08:00";
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.availableDays = 10L;
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.waitDaysAfterReceive = 1L;
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod = new FixedWeekPeriod();
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList = new ArrayList<>();
    {
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayList.add(WeekEnum.MONDAY);
    };
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayPeriodList = new ArrayList<>();
    {
      PeriodOfTheDay dayPeriodListItem = new PeriodOfTheDay();
      dayPeriodListItem.beginTime = 60L;
      dayPeriodListItem.endTime = 86399L;
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.weeklyAvailablePeriod.dayPeriodList.add(dayPeriodListItem);
    };
    request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.irregularAvailablePeriodList = new ArrayList<>();
    {
      TimePeriod irregularAvailablePeriodListItem = new TimePeriod();
      irregularAvailablePeriodListItem.beginTime = "2025-01-01T00:00:00+08:00";
      irregularAvailablePeriodListItem.endTime = "2025-10-01T00:00:00+08:00";
      request.stockBundle.progressiveBundleUsageRule.couponAvailablePeriod.irregularAvailablePeriodList.add(irregularAvailablePeriodListItem);
    };
    request.stockBundle.progressiveBundleUsageRule.normalCouponList = new ArrayList<>();
    {
      NormalCouponUsageRule normalCouponListItem = new NormalCouponUsageRule();
      normalCouponListItem.threshold = 10000L;
      normalCouponListItem.discountAmount = 100L;
      request.stockBundle.progressiveBundleUsageRule.normalCouponList.add(normalCouponListItem);
    };
    request.stockBundle.progressiveBundleUsageRule.discountCouponList = new ArrayList<>();
    {
      DiscountCouponUsageRule discountCouponListItem = new DiscountCouponUsageRule();
      discountCouponListItem.threshold = 10000L;
      discountCouponListItem.percentOff = 30L;
      request.stockBundle.progressiveBundleUsageRule.discountCouponList.add(discountCouponListItem);
    };
    request.stockBundle.progressiveBundleUsageRule.exchangeCouponList = new ArrayList<>();
    {
      ExchangeCouponUsageRule exchangeCouponListItem = new ExchangeCouponUsageRule();
      exchangeCouponListItem.threshold = 10000L;
      exchangeCouponListItem.exchangePrice = 100L;
      request.stockBundle.progressiveBundleUsageRule.exchangeCouponList.add(exchangeCouponListItem);
    };
    request.stockBundle.usageRuleDisplayInfo = new UsageRuleDisplayInfo();
    request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList = new ArrayList<>();
    {
      request.stockBundle.usageRuleDisplayInfo.couponUsageMethodList.add(CouponUsageMethod.OFFLINE);
    };
    request.stockBundle.usageRuleDisplayInfo.miniProgramAppid = "wx1234567890";
    request.stockBundle.usageRuleDisplayInfo.miniProgramPath = "/pages/index/product";
    request.stockBundle.usageRuleDisplayInfo.appPath = "https://www.example.com/jump-to-app";
    request.stockBundle.usageRuleDisplayInfo.usageDescription = "全场可用";
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo = new CouponAvailableStoreInfo();
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo.description = "可在上海市区的所有门店使用，详细列表参考小程序内信息为准";
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramAppid = "wx1234567890";
    request.stockBundle.usageRuleDisplayInfo.couponAvailableStoreInfo.miniProgramPath = "/pages/index/store-list";
    request.stockBundle.couponDisplayInfo = new CouponDisplayInfo();
    request.stockBundle.couponDisplayInfo.codeDisplayMode = CouponCodeDisplayMode.QRCODE;
    request.stockBundle.couponDisplayInfo.backgroundColor = "Color010";
    request.stockBundle.couponDisplayInfo.entranceMiniProgram = new EntranceMiniProgram();
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.appid = "wx1234567890";
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.path = "/pages/index/product";
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.entranceWording = "欢迎选购";
    request.stockBundle.couponDisplayInfo.entranceMiniProgram.guidanceWording = "获取更多优惠";
    request.stockBundle.couponDisplayInfo.entranceOfficialAccount = new EntranceOfficialAccount();
    request.stockBundle.couponDisplayInfo.entranceOfficialAccount.appid = "wx1234567890";
    request.stockBundle.couponDisplayInfo.entranceFinder = new EntranceFinder();
    request.stockBundle.couponDisplayInfo.entranceFinder.finderId = "gh_12345678";
    request.stockBundle.couponDisplayInfo.entranceFinder.finderVideoId = "UDFsdf24df34dD456Hdf34";
    request.stockBundle.couponDisplayInfo.entranceFinder.finderVideoCoverImageUrl = "https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx";
    request.stockBundle.notifyConfig = new NotifyConfig();
    request.stockBundle.notifyConfig.notifyAppid = "wx4fd12345678";
    request.stockBundle.storeScope = StockStoreScope.SPECIFIC;
    try {
      StockBundleEntity response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public StockBundleEntity run(CreateStockBundleRequest request) {
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
        return WXPayBrandUtility.fromJson(respBody, StockBundleEntity.class);
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

  public CreateStockBundle(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class CreateStockBundleRequest {
    @SerializedName("out_request_no")
    public String outRequestNo;
  
    @SerializedName("product_coupon_id")
    @Expose(serialize = false)
    public String productCouponId;
  
    @SerializedName("stock_bundle")
    public StockBundleForCreate stockBundle;
  }
  
  public static class StockBundleEntity {
    @SerializedName("stock_bundle_id")
    public String stockBundleId;
  
    @SerializedName("stock_list")
    public List<StockEntityInBundle> stockList = new ArrayList<StockEntityInBundle>();
  }
  
  public static class StockBundleForCreate {
    @SerializedName("remark")
    public String remark;
  
    @SerializedName("coupon_code_mode")
    public CouponCodeMode couponCodeMode;
  
    @SerializedName("stock_send_rule")
    public StockSendRuleForBundle stockSendRule;
  
    @SerializedName("progressive_bundle_usage_rule")
    public StockBundleUsageRule progressiveBundleUsageRule;
  
    @SerializedName("usage_rule_display_info")
    public UsageRuleDisplayInfo usageRuleDisplayInfo;
  
    @SerializedName("coupon_display_info")
    public CouponDisplayInfo couponDisplayInfo;
  
    @SerializedName("notify_config")
    public NotifyConfig notifyConfig;
  
    @SerializedName("store_scope")
    public StockStoreScope storeScope;
  }
  
  public static class StockEntityInBundle {
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
  
    @SerializedName("progressive_bundle_usage_rule")
    public StockUsageRule progressiveBundleUsageRule;
  
    @SerializedName("stock_bundle_info")
    public StockBundleInfo stockBundleInfo;
  
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
  
  public enum CouponCodeMode {
    @SerializedName("WECHATPAY")
    WECHATPAY,
    @SerializedName("UPLOAD")
    UPLOAD
  }
  
  public static class StockSendRuleForBundle {
    @SerializedName("max_count")
    public Long maxCount;
  
    @SerializedName("max_count_per_day")
    public Long maxCountPerDay;
  
    @SerializedName("max_count_per_user")
    public Long maxCountPerUser;
  }
  
  public static class StockBundleUsageRule {
    @SerializedName("coupon_available_period")
    public CouponAvailablePeriod couponAvailablePeriod;
  
    @SerializedName("normal_coupon_list")
    public List<NormalCouponUsageRule> normalCouponList;
  
    @SerializedName("discount_coupon_list")
    public List<DiscountCouponUsageRule> discountCouponList;
  
    @SerializedName("exchange_coupon_list")
    public List<ExchangeCouponUsageRule> exchangeCouponList;
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
  
  public static class StockUsageRule {
    @SerializedName("coupon_available_period")
    public CouponAvailablePeriod couponAvailablePeriod;
  
    @SerializedName("normal_coupon")
    public NormalCouponUsageRule normalCoupon;
  
    @SerializedName("discount_coupon")
    public DiscountCouponUsageRule discountCoupon;
  
    @SerializedName("exchange_coupon")
    public ExchangeCouponUsageRule exchangeCoupon;
  }
  
  public static class StockBundleInfo {
    @SerializedName("stock_bundle_id")
    public String stockBundleId;
  
    @SerializedName("stock_bundle_index")
    public Long stockBundleIndex;
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
