package com.java.demo;

import com.java.utils.WXPayUtility; // 引用微信支付工具库，参考：https://pay.weixin.qq.com/doc/v3/partner/4014985777

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
 * 同业过滤标签管理
 */
public class SetAdvertisingIndustryFilter {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/v3/goldplan/merchants/set-advertising-industry-filter";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
    SetAdvertisingIndustryFilter client = new SetAdvertisingIndustryFilter(
      "19xxxxxxxx",                    // 商户号
      "1DDE55AD98Exxxxxxxxxx",         // 商户API证书序列号
      "/path/to/apiclient_key.pem",     // 商户API证书私钥文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径
    );

    SetAdvertisingIndustryFilterRequest request = new SetAdvertisingIndustryFilterRequest();
    request.subMchid = "1900000109";
    request.advertisingIndustryFilters = new ArrayList<>();
    {
      request.advertisingIndustryFilters.add(IndustryType.E_COMMERCE);
    };
    try {
      client.run(request);
    } catch (WXPayUtility.ApiException e) {
        e.printStackTrace();
    }
  }

  public void run(SetAdvertisingIndustryFilterRequest request) {
    String uri = PATH;
    String reqBody = WXPayUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayUtility.buildAuthorization(mchid, certificateSerialNo,privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        WXPayUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);
        return;
      } else {
        throw new WXPayUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
    }
  }

  private final String mchid;
  private final String certificateSerialNo;
  private final PrivateKey privateKey;
  private final String wechatPayPublicKeyId;
  private final PublicKey wechatPayPublicKey;

  public SetAdvertisingIndustryFilter(String mchid, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.mchid = mchid;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class SetAdvertisingIndustryFilterRequest {
    @SerializedName("sub_mchid")
    public String subMchid;

    @SerializedName("advertising_industry_filters")
    public List<IndustryType> advertisingIndustryFilters = new ArrayList<IndustryType>();
  }

  public enum IndustryType {
    @SerializedName("E_COMMERCE") E_COMMERCE,
    @SerializedName("LOVE_MARRIAGE") LOVE_MARRIAGE,
    @SerializedName("POTOGRAPHY") POTOGRAPHY,
    @SerializedName("EDUCATION") EDUCATION,
    @SerializedName("FINANCE") FINANCE,
    @SerializedName("TOURISM") TOURISM,
    @SerializedName("SKINCARE") SKINCARE,
    @SerializedName("FOOD") FOOD,
    @SerializedName("SPORT") SPORT,
    @SerializedName("JEWELRY_WATCH") JEWELRY_WATCH,
    @SerializedName("HEALTHCARE") HEALTHCARE,
    @SerializedName("BUSSINESS") BUSSINESS,
    @SerializedName("PARENTING") PARENTING,
    @SerializedName("CATERING") CATERING,
    @SerializedName("RETAIL") RETAIL,
    @SerializedName("SERVICES") SERVICES,
    @SerializedName("LAW") LAW,
    @SerializedName("ESTATE") ESTATE,
    @SerializedName("TRANSPORTATION") TRANSPORTATION,
    @SerializedName("ENERGY_SAVING") ENERGY_SAVING,
    @SerializedName("SECURITY") SECURITY,
    @SerializedName("BUILDING_MATERIAL") BUILDING_MATERIAL,
    @SerializedName("COMMUNICATION") COMMUNICATION,
    @SerializedName("MERCHANDISE") MERCHANDISE,
    @SerializedName("ASSOCIATION") ASSOCIATION,
    @SerializedName("COMMUNITY") COMMUNITY,
    @SerializedName("ONLINE_AVR") ONLINE_AVR,
    @SerializedName("WE_MEDIA") WE_MEDIA,
    @SerializedName("CAR") CAR,
    @SerializedName("SOFTWARE") SOFTWARE,
    @SerializedName("GAME") GAME,
    @SerializedName("CLOTHING") CLOTHING,
    @SerializedName("INDUSTY") INDUSTY,
    @SerializedName("AGRICULTURE") AGRICULTURE,
    @SerializedName("PUBLISHING_MEDIA") PUBLISHING_MEDIA,
    @SerializedName("HOME_DIGITAL") HOME_DIGITAL
  }

}
