package com.java.demo;

import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;
import com.java.utils.WXPayUtility; // 引用微信支付工具库 参考:https://pay.weixin.qq.com/doc/v3/partner/4014985777
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.security.PrivateKey;
import java.security.PublicKey;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import okhttp3.Response;
import java.net.URI;
import java.net.URISyntaxException;
import org.apache.commons.codec.digest.DigestUtils;
import java.util.zip.GZIPInputStream;

/**
 * 下载账单
 */
public class DownloadBill {
    private static String METHOD = "GET";

    public static void main(String[] args) {
        // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/v3/partner/4013080340
        DownloadBill client = new DownloadBill(
                "19xxxxxxxx", // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考 https://pay.weixin.qq.com/doc/v3/partner/4013080340
                "1DDE55AD98Exxxxxxxxxx", // 商户API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013058924
                "/path/to/apiclient_key.pem", // 商户API证书私钥文件路径，本地文件路径
                "PUB_KEY_ID_xxxxxxxxxxxxx", // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/v3/partner/4013038589
                "/path/to/wxp_pub.pem" // 微信支付公钥文件路径，本地文件路径
        );

        DownloadBillRequest request = new DownloadBillRequest();
        request.downloadUrl = "https://api.mch.weixin.qq.com/v3/billdownload/file?token=xxx";
        request.localFilePath = "downloaded_bill.csv";
        request.expectedHashType = HashType.SHA1;
        request.expectedHashValue = "79bb0f45fc4c42234a918000b2668d689e2bde04";
        request.tarType = TarType.GZIP;
        try {
            client.run(request);

            // TODO: 请求成功，继续业务逻辑
            System.out.println("File downloaded successfully! Local file path: " + request.localFilePath);
        } catch (WXPayUtility.ApiException e) {
            // TODO: 请求失败，根据状态码执行不同的逻辑
            e.printStackTrace();
        }
    }

    public void run(DownloadBillRequest request) {
        Request.Builder reqBuilder = new Request.Builder().url(request.downloadUrl);

        String uri = getPathQueryFromUrl(request.downloadUrl);
        reqBuilder.addHeader("Accept", "application/json");
        reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
        reqBuilder.addHeader("Authorization",
                WXPayUtility.buildAuthorization(mchid, certificateSerialNo, privateKey, METHOD, uri, null));
        reqBuilder.method(METHOD, null);
        Request httpRequest = reqBuilder.build();

        // 发送HTTP请求
        OkHttpClient client = new OkHttpClient.Builder().build();
        try (Response httpResponse = client.newCall(httpRequest).execute()) {
            if (httpResponse.code() < 200 || httpResponse.code() > 300) {
                String respBody = WXPayUtility.extractBody(httpResponse);
                throw new WXPayUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
            }

            // 2XX 成功，流式下载文件
            ResponseBody body = httpResponse.body();
            if (body == null) {
                throw new IOException("Response body is null");
            }
            // 读取流
            try (InputStream inputStream = (request.tarType == DownloadBill.TarType.GZIP)
                    ? new GZIPInputStream(body.byteStream())
                    : body.byteStream();
                    FileOutputStream outputStream = new FileOutputStream(request.localFilePath)) {

                byte[] buffer = new byte[8096];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                outputStream.flush();
            }
            // 下载成功后校验文件SHA1
            if (request.expectedHashType == HashType.SHA1) {
                String sha1 = DigestUtils.sha1Hex(new FileInputStream(request.localFilePath));
                if (!sha1.equals(request.expectedHashValue)) {
                    throw new IOException("SHA1 checksum mismatch");
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
        }
    }

    private String getPathQueryFromUrl(String url) {
        try {
            URI uri = new URI(url);
            String path = uri.getRawPath(); // /v3/billdownload/file
            String query = uri.getRawQuery(); // token=xxx&tartype=gzip
            return (query == null || query.isEmpty()) ? path : path + "?" + query;
        } catch (URISyntaxException e) {
            e.printStackTrace();
            return "";
        }
    }

    private final String mchid;
    private final String certificateSerialNo;
    private final PrivateKey privateKey;
    private final String wechatPayPublicKeyId;
    private final PublicKey wechatPayPublicKey;

    public DownloadBill(String mchid, String certificateSerialNo, String privateKeyFilePath,
            String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
        this.mchid = mchid;
        this.certificateSerialNo = certificateSerialNo;
        this.privateKey = WXPayUtility.loadPrivateKeyFromPath(privateKeyFilePath);
        this.wechatPayPublicKeyId = wechatPayPublicKeyId;
        this.wechatPayPublicKey = WXPayUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
    }

    public enum HashType {
        @SerializedName("SHA1")
        SHA1
    }

    public static class DownloadBillRequest {
        @SerializedName("download_url")
        @Expose(serialize = false)
        public String downloadUrl;

        @SerializedName("local_file_path")
        @Expose(serialize = false)
        public String localFilePath;

        @SerializedName("expected_hash_type")
        @Expose(serialize = false)
        public HashType expectedHashType;

        @SerializedName("expected_hash_value")
        @Expose(serialize = false)
        public String expectedHashValue;

        @SerializedName("tar_type")
        @Expose(serialize = false)
        public TarType tarType;
    }

    public enum TarType {
        @SerializedName("GZIP")
        GZIP
    }
}
