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
 * 失效商品券批次
 */
public class DeactivateStock {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/brand/marketing/product-coupon/product-coupons/{product_coupon_id}/stocks/{stock_id}/deactivate";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
    DeactivateStock client = new DeactivateStock(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    DeactivateStockRequest request = new DeactivateStockRequest();
    request.outRequestNo = "de_34657_20250101_123456";
    request.productCouponId = "1000000013";
    request.stockId = "1000000013001";
    request.deactivateReason = "批次信息有误，重新创建";
    try {
      StockEntity response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public StockEntity run(DeactivateStockRequest request) {
    String uri = PATH;
    uri = uri.replace("{product_coupon_id}", WXPayBrandUtility.urlEncode(request.productCouponId));
    uri = uri.replace("{stock_id}", WXPayBrandUtility.urlEncode(request.stockId));
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

  public DeactivateStock(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class DeactivateStockRequest {
    @SerializedName("out_request_no")
    public String outRequestNo;
  
    @SerializedName("product_coupon_id")
    @Expose(serialize = false)
    public String productCouponId;
  
    @SerializedName("stock_id")
    @Expose(serialize = false)
    public String stockId;
  
    @SerializedName("deactivate_reason")
    public String deactivateReason;
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
