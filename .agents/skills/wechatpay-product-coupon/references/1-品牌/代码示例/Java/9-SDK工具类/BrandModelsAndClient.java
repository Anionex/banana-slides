package com.wechat.pay.java.core.test.productCoupon;

import com.java.utils.WXPayBrandUtility; // 引用微信支付工具库

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
 * 品牌直连模式 - 公共代码（HTTP客户端 + 数据模型）
 *
 * 本文件包含品牌直连模式下创建商品券所需的：
 * 1. HTTP 客户端（签名、发送请求、验签）
 * 2. 所有请求/响应数据模型类定义
 * 3. 所有枚举类型定义
 *
 * 各业务示例文件只需包含 main() 中构建 request 对象的代码，
 * 其余部分引用本文件即可。
 */
public class BrandModelsAndClient {

  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/brand/marketing/product-coupon/product-coupons";

  // ========== HTTP 客户端 ==========

  public CreateProductCouponResponse run(CreateProductCouponRequest request) {
    String uri = PATH;
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
        return WXPayBrandUtility.fromJson(respBody, CreateProductCouponResponse.class);
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

  public BrandModelsAndClient(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  // ========== 请求/响应数据模型 ==========

  /** 创建商品券请求（单券模式） */
  public static class CreateProductCouponRequest {
    /** 必填，创建请求单号，品牌侧需保持唯一性，6-40个字符 */
    @SerializedName("out_request_no")
    public String outRequestNo;

    /** 必填，优惠范围：ALL-全场券，SINGLE-单品券 */
    @SerializedName("scope")
    public ProductCouponScope scope;

    /** 必填，商品券类型：NORMAL-满减券，DISCOUNT-折扣券，EXCHANGE-兑换券(仅scope=SINGLE时可用) */
    @SerializedName("type")
    public ProductCouponType type;

    /** 必填，使用模式：SINGLE-单券，PROGRESSIVE_BUNDLE-多次优惠 */
    @SerializedName("usage_mode")
    public UsageMode usageMode;

    /** 条件必填，单券模式信息。当usage_mode=SINGLE且scope=ALL时，需填写优惠规则 */
    @SerializedName("single_usage_info")
    public SingleUsageInfo singleUsageInfo;

    /** 条件必填，多次优惠模式信息。当usage_mode=PROGRESSIVE_BUNDLE时必填 */
    @SerializedName("progressive_bundle_usage_info")
    public ProgressiveBundleUsageInfo progressiveBundleUsageInfo;

    /** 必填，商品券展示信息 */
    @SerializedName("display_info")
    public ProductCouponDisplayInfo displayInfo;

    /** 选填，商户侧商品券唯一标识 */
    @SerializedName("out_product_no")
    public String outProductNo;

    /** 条件必填，批次信息。当usage_mode=SINGLE时必填 */
    @SerializedName("stock")
    public StockForCreate stock;

    /** 条件必填，批次信息。当usage_mode=PROGRESSIVE_BUNDLE时必填 */
    @SerializedName("stock_bundle")
    public StockForCreate stockBundle;
  }

  /** 创建商品券响应 */
  public static class CreateProductCouponResponse {
    @SerializedName("product_coupon_id")
    public String productCouponId;

    @SerializedName("scope")
    public ProductCouponScope scope;

    @SerializedName("type")
    public ProductCouponType type;

    @SerializedName("usage_mode")
    public UsageMode usageMode;

    @SerializedName("single_usage_info")
    public SingleUsageInfo singleUsageInfo;

    @SerializedName("progressive_bundle_usage_info")
    public ProgressiveBundleUsageInfo progressiveBundleUsageInfo;

    @SerializedName("display_info")
    public ProductCouponDisplayInfo displayInfo;

    @SerializedName("out_product_no")
    public String outProductNo;

    @SerializedName("state")
    public ProductCouponState state;

    @SerializedName("stock")
    public StockEntity stock;

    @SerializedName("stock_bundle")
    public StockEntity stockBundle;
  }

  // ========== 枚举类型 ==========

  public enum ProductCouponScope {
    @SerializedName("ALL") ALL,
    @SerializedName("SINGLE") SINGLE
  }

  public enum ProductCouponType {
    @SerializedName("NORMAL") NORMAL,
    @SerializedName("DISCOUNT") DISCOUNT,
    @SerializedName("EXCHANGE") EXCHANGE
  }

  public enum UsageMode {
    @SerializedName("SINGLE") SINGLE,
    @SerializedName("PROGRESSIVE_BUNDLE") PROGRESSIVE_BUNDLE
  }

  public enum ProductCouponState {
    @SerializedName("AUDITING") AUDITING,
    @SerializedName("EFFECTIVE") EFFECTIVE,
    @SerializedName("DEACTIVATED") DEACTIVATED
  }

  public enum CouponCodeMode {
    @SerializedName("WECHATPAY") WECHATPAY,
    @SerializedName("UPLOAD") UPLOAD,
    @SerializedName("API_ASSIGN") API_ASSIGN
  }

  public enum StockStoreScope {
    @SerializedName("NONE") NONE,
    @SerializedName("ALL") ALL,
    @SerializedName("SPECIFIC") SPECIFIC
  }

  public enum CouponCodeDisplayMode {
    @SerializedName("INVISIBLE") INVISIBLE,
    @SerializedName("BARCODE") BARCODE,
    @SerializedName("QRCODE") QRCODE
  }

  public enum CouponUsageMethod {
    @SerializedName("OFFLINE") OFFLINE,
    @SerializedName("MINI_PROGRAM") MINI_PROGRAM,
    @SerializedName("APP") APP,
    @SerializedName("PAYMENT_CODE") PAYMENT_CODE
  }

  public enum WeekEnum {
    @SerializedName("MONDAY") MONDAY,
    @SerializedName("TUESDAY") TUESDAY,
    @SerializedName("WEDNESDAY") WEDNESDAY,
    @SerializedName("THURSDAY") THURSDAY,
    @SerializedName("FRIDAY") FRIDAY,
    @SerializedName("SATURDAY") SATURDAY,
    @SerializedName("SUNDAY") SUNDAY
  }

  public enum StockState {
    @SerializedName("AUDITING") AUDITING,
    @SerializedName("SENDING") SENDING,
    @SerializedName("PAUSED") PAUSED,
    @SerializedName("STOPPED") STOPPED,
    @SerializedName("DEACTIVATED") DEACTIVATED
  }

  public enum SequentialUsageType {
    @SerializedName("INCREMENTAL") INCREMENTAL,
    @SerializedName("EQUAL") EQUAL
  }

  // ========== 数据模型类 ==========

  public static class SingleUsageInfo {
    @SerializedName("normal_coupon")
    public NormalCouponUsageRule normalCoupon;

    @SerializedName("discount_coupon")
    public DiscountCouponUsageRule discountCoupon;
  }

  public static class ProgressiveBundleUsageInfo {
    @SerializedName("count")
    public Long count;

    @SerializedName("interval_days")
    public Long intervalDays;
  }

  public static class ProductCouponDisplayInfo {
    @SerializedName("name")
    public String name;

    @SerializedName("image_url")
    public String imageUrl;

    @SerializedName("background_url")
    public String backgroundUrl;

    @SerializedName("detail_image_url_list")
    public List<String> detailImageUrlList;

    @SerializedName("original_price")
    public Long originalPrice;

    @SerializedName("combo_package_list")
    public List<ComboPackage> comboPackageList;
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

    @SerializedName("progressive_bundle_usage_rule")
    public ProgressiveBundleUsageRule progressiveBundleUsageRule;

    @SerializedName("usage_rule_display_info")
    public UsageRuleDisplayInfo usageRuleDisplayInfo;

    @SerializedName("coupon_display_info")
    public CouponDisplayInfo couponDisplayInfo;

    @SerializedName("notify_config")
    public NotifyConfig notifyConfig;

    @SerializedName("store_scope")
    public StockStoreScope storeScope;
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

    @SerializedName("progressive_bundle_usage_rule")
    public ProgressiveBundleUsageRule progressiveBundleUsageRule;

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

  public static class ComboPackage {
    @SerializedName("name")
    public String name;

    @SerializedName("pick_count")
    public Long pickCount;

    @SerializedName("choice_list")
    public List<ComboPackageChoice> choiceList = new ArrayList<ComboPackageChoice>();
  }

  public static class ComboPackageChoice {
    @SerializedName("name")
    public String name;

    @SerializedName("price")
    public Long price;

    @SerializedName("count")
    public Long count;

    @SerializedName("image_url")
    public String imageUrl;

    @SerializedName("mini_program_appid")
    public String miniProgramAppid;

    @SerializedName("mini_program_path")
    public String miniProgramPath;
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

  public static class ProgressiveBundleUsageRule {
    @SerializedName("coupon_available_period")
    public CouponAvailablePeriod couponAvailablePeriod;

    @SerializedName("special_first")
    public Boolean specialFirst;

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

  public static class CouponCodeCountInfo {
    @SerializedName("total_count")
    public Long totalCount;

    @SerializedName("available_count")
    public Long availableCount;
  }

  public static class StockSentCountInfo {
    @SerializedName("total_count")
    public Long totalCount;

    @SerializedName("today_count")
    public Long todayCount;
  }

  public static class CouponAvailablePeriod {
    /** 可用开始时间。例如：2015-05-20T13:29:35+08:00 */
    @SerializedName("available_begin_time")
    public String availableBeginTime;

    /** 可用结束时间。例如：2015-05-20T13:29:35+08:00 */
    @SerializedName("available_end_time")
    public String availableEndTime;

    @SerializedName("available_days")
    public Long availableDays;

    @SerializedName("wait_days_after_receive")
    public Long waitDaysAfterReceive;

    @SerializedName("interval_days")
    public Long intervalDays;

    @SerializedName("weekly_available_period")
    public FixedWeekPeriod weeklyAvailablePeriod;

    @SerializedName("irregular_available_period_list")
    public List<TimePeriod> irregularAvailablePeriodList;
  }

  public static class CouponAvailableStoreInfo {
    @SerializedName("description")
    public String description;

    @SerializedName("mini_program_appid")
    public String miniProgramAppid;

    @SerializedName("mini_program_path")
    public String miniProgramPath;
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
    /** 开始时间。例如：2015-05-20T13:29:35+08:00 */
    @SerializedName("begin_time")
    public String beginTime;

    /** 结束时间。例如：2015-05-20T13:29:35+08:00 */
    @SerializedName("end_time")
    public String endTime;
  }

  public static class PeriodOfTheDay {
    @SerializedName("begin_time")
    public Long beginTime;

    @SerializedName("end_time")
    public Long endTime;
  }
}
