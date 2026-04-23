package com.java.utils;

import com.google.gson.ExclusionStrategy;
import com.google.gson.FieldAttributes;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;
import java.util.List;
import java.util.Map.Entry;
import okhttp3.Headers;
import okhttp3.Response;
import okio.BufferedSource;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.SignatureException;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.security.MessageDigest;
import java.io.InputStream;
import org.bouncycastle.crypto.digests.SM3Digest;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import java.security.Security;

public class WXPayUtility {
    private static final Gson gson = new GsonBuilder()
            .disableHtmlEscaping()
            .addSerializationExclusionStrategy(new ExclusionStrategy() {
                @Override
                public boolean shouldSkipField(FieldAttributes fieldAttributes) {
                    final Expose expose = fieldAttributes.getAnnotation(Expose.class);
                    return expose != null && !expose.serialize();
                }

                @Override
                public boolean shouldSkipClass(Class<?> aClass) {
                    return false;
                }
            })
            .addDeserializationExclusionStrategy(new ExclusionStrategy() {
                @Override
                public boolean shouldSkipField(FieldAttributes fieldAttributes) {
                    final Expose expose = fieldAttributes.getAnnotation(Expose.class);
                    return expose != null && !expose.deserialize();
                }

                @Override
                public boolean shouldSkipClass(Class<?> aClass) {
                    return false;
                }
            })
            .create();
    private static final char[] SYMBOLS =
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".toCharArray();
    private static final SecureRandom random = new SecureRandom();

    public static String toJson(Object object) {
        return gson.toJson(object);
    }

    public static <T> T fromJson(String json, Class<T> classOfT) throws JsonSyntaxException {
        return gson.fromJson(json, classOfT);
    }

    private static String readKeyStringFromPath(String keyPath) {
        try {
            return new String(Files.readAllBytes(Paths.get(keyPath)), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static PrivateKey loadPrivateKeyFromString(String keyString) {
        try {
            keyString = keyString.replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s+", "");
            return KeyFactory.getInstance("RSA").generatePrivate(
                    new PKCS8EncodedKeySpec(Base64.getDecoder().decode(keyString)));
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException(e);
        } catch (InvalidKeySpecException e) {
            throw new IllegalArgumentException(e);
        }
    }

    public static PrivateKey loadPrivateKeyFromPath(String keyPath) {
        return loadPrivateKeyFromString(readKeyStringFromPath(keyPath));
    }

    public static PublicKey loadPublicKeyFromString(String keyString) {
        try {
            keyString = keyString.replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s+", "");
            return KeyFactory.getInstance("RSA").generatePublic(
                    new X509EncodedKeySpec(Base64.getDecoder().decode(keyString)));
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException(e);
        } catch (InvalidKeySpecException e) {
            throw new IllegalArgumentException(e);
        }
    }

    public static PublicKey loadPublicKeyFromPath(String keyPath) {
        return loadPublicKeyFromString(readKeyStringFromPath(keyPath));
    }

    public static String createNonce(int length) {
        char[] buf = new char[length];
        for (int i = 0; i < length; ++i) {
            buf[i] = SYMBOLS[random.nextInt(SYMBOLS.length)];
        }
        return new String(buf);
    }

    public static String encrypt(PublicKey publicKey, String plaintext) {
        final String transformation = "RSA/ECB/OAEPWithSHA-1AndMGF1Padding";

        try {
            Cipher cipher = Cipher.getInstance(transformation);
            cipher.init(Cipher.ENCRYPT_MODE, publicKey);
            return Base64.getEncoder().encodeToString(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | NoSuchPaddingException e) {
            throw new IllegalArgumentException("The current Java environment does not support " + transformation, e);
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException("RSA encryption using an illegal publicKey", e);
        } catch (BadPaddingException | IllegalBlockSizeException e) {
            throw new IllegalArgumentException("Plaintext is too long", e);
        }
    }

    public static String rsaOaepDecrypt(PrivateKey privateKey, String ciphertext) {
        final String transformation = "RSA/ECB/OAEPWithSHA-1AndMGF1Padding";

        try {
            Cipher cipher = Cipher.getInstance(transformation);
            cipher.init(Cipher.DECRYPT_MODE, privateKey);
            byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(ciphertext));
            return new String(decryptedBytes, StandardCharsets.UTF_8);
        } catch (NoSuchAlgorithmException | NoSuchPaddingException e) {
            throw new IllegalArgumentException("The current Java environment does not support " + transformation, e);
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException("RSA decryption using an illegal privateKey", e);
        } catch (BadPaddingException | IllegalBlockSizeException e) {
            throw new IllegalArgumentException("Ciphertext decryption failed", e);
        }
    }

    public static String aesAeadDecrypt(byte[] key, byte[] associatedData, byte[] nonce,
                                        byte[] ciphertext) {
        final String transformation = "AES/GCM/NoPadding";
        final String algorithm = "AES";
        final int tagLengthBit = 128;

        try {
            Cipher cipher = Cipher.getInstance(transformation);
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key, algorithm),
                    new GCMParameterSpec(tagLengthBit, nonce));
            if (associatedData != null) {
                cipher.updateAAD(associatedData);
            }
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (InvalidKeyException
                 | InvalidAlgorithmParameterException
                 | BadPaddingException
                 | IllegalBlockSizeException
                 | NoSuchAlgorithmException
                 | NoSuchPaddingException e) {
            throw new IllegalArgumentException(String.format("AesAeadDecrypt with %s Failed",
                    transformation), e);
        }
    }

    public static String sign(String message, String algorithm, PrivateKey privateKey) {
        byte[] sign;
        try {
            Signature signature = Signature.getInstance(algorithm);
            signature.initSign(privateKey);
            signature.update(message.getBytes(StandardCharsets.UTF_8));
            sign = signature.sign();
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException("The current Java environment does not support " + algorithm, e);
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException(algorithm + " signature uses an illegal privateKey.", e);
        } catch (SignatureException e) {
            throw new RuntimeException("An error occurred during the sign process.", e);
        }
        return Base64.getEncoder().encodeToString(sign);
    }

    public static boolean verify(String message, String signature, String algorithm,
                                 PublicKey publicKey) {
        try {
            Signature sign = Signature.getInstance(algorithm);
            sign.initVerify(publicKey);
            sign.update(message.getBytes(StandardCharsets.UTF_8));
            return sign.verify(Base64.getDecoder().decode(signature));
        } catch (SignatureException e) {
            return false;
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException("verify uses an illegal publickey.", e);
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException("The current Java environment does not support" + algorithm, e);
        }
    }

    public static String buildAuthorization(String mchid, String certificateSerialNo,
                                            PrivateKey privateKey,
                                            String method, String uri, String body) {
        String nonce = createNonce(32);
        long timestamp = Instant.now().getEpochSecond();

        String message = String.format("%s\n%s\n%d\n%s\n%s\n", method, uri, timestamp, nonce,
                body == null ? "" : body);

        String signature = sign(message, "SHA256withRSA", privateKey);

        return String.format(
                "WECHATPAY2-SHA256-RSA2048 mchid=\"%s\",nonce_str=\"%s\",signature=\"%s\"," +
                        "timestamp=\"%d\",serial_no=\"%s\"",
                mchid, nonce, signature, timestamp, certificateSerialNo);
    }

    private static String calculateHash(InputStream inputStream, String algorithm) {
        try {
            MessageDigest digest = MessageDigest.getInstance(algorithm);
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
            byte[] hashBytes = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException(algorithm + " algorithm not available", e);
        } catch (IOException e) {
            throw new RuntimeException("Error reading from input stream", e);
        }
    }

    public static String sha256(InputStream inputStream) {
        return calculateHash(inputStream, "SHA-256");
    }

    public static String sha1(InputStream inputStream) {
        return calculateHash(inputStream, "SHA-1");
    }

    public static String sm3(InputStream inputStream) {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }

        try {
            SM3Digest digest = new SM3Digest();
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
            byte[] hashBytes = new byte[digest.getDigestSize()];
            digest.doFinal(hashBytes, 0);

            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (IOException e) {
            throw new RuntimeException("Error reading from input stream", e);
        }
    }

    public static String urlEncode(String content) {
        try {
            return URLEncoder.encode(content, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException e) {
            throw new RuntimeException(e);
        }
    }

    public static String urlEncode(Map<String, Object> params) {
        if (params == null || params.isEmpty()) {
            return "";
        }

        StringBuilder result = new StringBuilder();
        for (Entry<String, Object> entry : params.entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }

            String key = entry.getKey();
            Object value = entry.getValue();
            if (value instanceof List) {
                List<?> list = (List<?>) entry.getValue();
                for (Object temp : list) {
                    appendParam(result, key, temp);
                }
            } else {
                appendParam(result, key, value);
            }
        }
        return result.toString();
    }

    private static void appendParam(StringBuilder result, String key, Object value) {
        if (result.length() > 0) {
            result.append("&");
        }

        String valueString;
        if (value instanceof String || value instanceof Number ||
                value instanceof Boolean || value instanceof Enum) {
            valueString = value.toString();
        } else {
            valueString = toJson(value);
        }

        result.append(key)
                .append("=")
                .append(urlEncode(valueString));
    }

    public static String extractBody(Response response) {
        if (response.body() == null) {
            return "";
        }

        try {
            BufferedSource source = response.body().source();
            return source.readUtf8();
        } catch (IOException e) {
            throw new RuntimeException(String.format("An error occurred during reading response body. " +
                    "Status: %d", response.code()), e);
        }
    }

    public static void validateResponse(String wechatpayPublicKeyId, PublicKey wechatpayPublicKey,
                                        Headers headers,
                                        String body) {
        String timestamp = headers.get("Wechatpay-Timestamp");
        String requestId = headers.get("Request-ID");
        try {
            Instant responseTime = Instant.ofEpochSecond(Long.parseLong(timestamp));
            if (Duration.between(responseTime, Instant.now()).abs().toMinutes() >= 5) {
                throw new IllegalArgumentException(
                        String.format("Validate response failed, timestamp[%s] is expired, request-id[%s]",
                                timestamp, requestId));
            }
        } catch (DateTimeException | NumberFormatException e) {
            throw new IllegalArgumentException(
                    String.format("Validate response failed, timestamp[%s] is invalid, request-id[%s]",
                            timestamp, requestId));
        }
        String serialNumber = headers.get("Wechatpay-Serial");
        if (!Objects.equals(serialNumber, wechatpayPublicKeyId)) {
            throw new IllegalArgumentException(
                    String.format("Validate response failed, Invalid Wechatpay-Serial, Local: %s, Remote: " +
                            "%s", wechatpayPublicKeyId, serialNumber));
        }

        String signature = headers.get("Wechatpay-Signature");
        String message = String.format("%s\n%s\n%s\n", timestamp, headers.get("Wechatpay-Nonce"),
                body == null ? "" : body);

        boolean success = verify(message, signature, "SHA256withRSA", wechatpayPublicKey);
        if (!success) {
            throw new IllegalArgumentException(
                    String.format("Validate response failed,the WechatPay signature is incorrect.%n"
                                    + "Request-ID[%s]\tresponseHeader[%s]\tresponseBody[%.1024s]",
                            headers.get("Request-ID"), headers, body));
        }
    }

    public static void validateNotification(String wechatpayPublicKeyId,
                                            PublicKey wechatpayPublicKey, Headers headers,
                                            String body) {
        String timestamp = headers.get("Wechatpay-Timestamp");
        try {
            Instant responseTime = Instant.ofEpochSecond(Long.parseLong(timestamp));
            if (Duration.between(responseTime, Instant.now()).abs().toMinutes() >= 5) {
                throw new IllegalArgumentException(
                        String.format("Validate notification failed, timestamp[%s] is expired", timestamp));
            }
        } catch (DateTimeException | NumberFormatException e) {
            throw new IllegalArgumentException(
                    String.format("Validate notification failed, timestamp[%s] is invalid", timestamp));
        }
        String serialNumber = headers.get("Wechatpay-Serial");
        if (!Objects.equals(serialNumber, wechatpayPublicKeyId)) {
            throw new IllegalArgumentException(
                    String.format("Validate notification failed, Invalid Wechatpay-Serial, Local: %s, " +
                                    "Remote: %s",
                            wechatpayPublicKeyId,
                            serialNumber));
        }

        String signature = headers.get("Wechatpay-Signature");
        String message = String.format("%s\n%s\n%s\n", timestamp, headers.get("Wechatpay-Nonce"),
                body == null ? "" : body);

        boolean success = verify(message, signature, "SHA256withRSA", wechatpayPublicKey);
        if (!success) {
            throw new IllegalArgumentException(
                    String.format("Validate notification failed, WechatPay signature is incorrect.\n"
                                    + "responseHeader[%s]\tresponseBody[%.1024s]",
                            headers, body));
        }
    }

    public static Notification parseNotification(String apiv3Key, String wechatpayPublicKeyId,
                                                 PublicKey wechatpayPublicKey, Headers headers,
                                                 String body) {
        validateNotification(wechatpayPublicKeyId, wechatpayPublicKey, headers, body);
        Notification notification = gson.fromJson(body, Notification.class);
        notification.decrypt(apiv3Key);
        return notification;
    }

    public static class ApiException extends RuntimeException {
        private static final long serialVersionUID = 2261086748874802175L;

        private final int statusCode;
        private final String body;
        private final Headers headers;
        private final String errorCode;
        private final String errorMessage;

        public ApiException(int statusCode, String body, Headers headers) {
            super(String.format("微信支付API访问失败，StatusCode: [%s], Body: [%s], Headers: [%s]", statusCode,
                    body, headers));
            this.statusCode = statusCode;
            this.body = body;
            this.headers = headers;

            if (body != null && !body.isEmpty()) {
                JsonElement code;
                JsonElement message;

                try {
                    JsonObject jsonObject = gson.fromJson(body, JsonObject.class);
                    code = jsonObject.get("code");
                    message = jsonObject.get("message");
                } catch (JsonSyntaxException ignored) {
                    code = null;
                    message = null;
                }
                this.errorCode = code == null ? null : code.getAsString();
                this.errorMessage = message == null ? null : message.getAsString();
            } else {
                this.errorCode = null;
                this.errorMessage = null;
            }
        }

        public int getStatusCode() {
            return statusCode;
        }

        public String getBody() {
            return body;
        }

        public Headers getHeaders() {
            return headers;
        }

        public String getErrorCode() {
            return errorCode;
        }

        public String getErrorMessage() {
            return errorMessage;
        }
    }

    public static class Notification {
        @SerializedName("id")
        private String id;
        @SerializedName("create_time")
        private String createTime;
        @SerializedName("event_type")
        private String eventType;
        @SerializedName("resource_type")
        private String resourceType;
        @SerializedName("summary")
        private String summary;
        @SerializedName("resource")
        private Resource resource;
        private String plaintext;

        public String getId() {
            return id;
        }

        public String getCreateTime() {
            return createTime;
        }

        public String getEventType() {
            return eventType;
        }

        public String getResourceType() {
            return resourceType;
        }

        public String getSummary() {
            return summary;
        }

        public Resource getResource() {
            return resource;
        }

        public String getPlaintext() {
            return plaintext;
        }

        private void validate() {
            if (resource == null) {
                throw new IllegalArgumentException("Missing required field `resource` in notification");
            }
            resource.validate();
        }

        private void decrypt(String apiv3Key) {
            validate();

            plaintext = aesAeadDecrypt(
                    apiv3Key.getBytes(StandardCharsets.UTF_8),
                    resource.associatedData.getBytes(StandardCharsets.UTF_8),
                    resource.nonce.getBytes(StandardCharsets.UTF_8),
                    Base64.getDecoder().decode(resource.ciphertext)
            );
        }

        public static class Resource {
            @SerializedName("algorithm")
            private String algorithm;

            @SerializedName("ciphertext")
            private String ciphertext;

            @SerializedName("associated_data")
            private String associatedData;

            @SerializedName("nonce")
            private String nonce;

            @SerializedName("original_type")
            private String originalType;

            public String getAlgorithm() {
                return algorithm;
            }

            public String getCiphertext() {
                return ciphertext;
            }

            public String getAssociatedData() {
                return associatedData;
            }

            public String getNonce() {
                return nonce;
            }

            public String getOriginalType() {
                return originalType;
            }

            private void validate() {
                if (algorithm == null || algorithm.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `algorithm` in Notification" +
                            ".Resource");
                }
                if (!Objects.equals(algorithm, "AEAD_AES_256_GCM")) {
                    throw new IllegalArgumentException(String.format("Unsupported `algorithm`[%s] in " +
                            "Notification.Resource", algorithm));
                }

                if (ciphertext == null || ciphertext.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `ciphertext` in Notification" +
                            ".Resource");
                }

                if (associatedData == null || associatedData.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `associatedData` in " +
                            "Notification.Resource");
                }

                if (nonce == null || nonce.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `nonce` in Notification" +
                            ".Resource");
                }

                if (originalType == null || originalType.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `originalType` in " +
                            "Notification.Resource");
                }
            }
        }
    }

    public static String getContentTypeByFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return "application/octet-stream";
        }

        String extension = "";
        int lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < fileName.length() - 1) {
            extension = fileName.substring(lastDotIndex + 1).toLowerCase();
        }

        Map<String, String> contentTypeMap = new HashMap<>();
        contentTypeMap.put("png", "image/png");
        contentTypeMap.put("jpg", "image/jpeg");
        contentTypeMap.put("jpeg", "image/jpeg");
        contentTypeMap.put("gif", "image/gif");
        contentTypeMap.put("bmp", "image/bmp");
        contentTypeMap.put("webp", "image/webp");
        contentTypeMap.put("svg", "image/svg+xml");
        contentTypeMap.put("ico", "image/x-icon");
        contentTypeMap.put("pdf", "application/pdf");
        contentTypeMap.put("doc", "application/msword");
        contentTypeMap.put("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        contentTypeMap.put("xls", "application/vnd.ms-excel");
        contentTypeMap.put("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        contentTypeMap.put("ppt", "application/vnd.ms-powerpoint");
        contentTypeMap.put("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
        contentTypeMap.put("txt", "text/plain");
        contentTypeMap.put("html", "text/html");
        contentTypeMap.put("css", "text/css");
        contentTypeMap.put("js", "application/javascript");
        contentTypeMap.put("json", "application/json");
        contentTypeMap.put("xml", "application/xml");
        contentTypeMap.put("csv", "text/csv");
        contentTypeMap.put("mp3", "audio/mpeg");
        contentTypeMap.put("wav", "audio/wav");
        contentTypeMap.put("mp4", "video/mp4");
        contentTypeMap.put("avi", "video/x-msvideo");
        contentTypeMap.put("mov", "video/quicktime");
        contentTypeMap.put("zip", "application/zip");
        contentTypeMap.put("rar", "application/x-rar-compressed");
        contentTypeMap.put("7z", "application/x-7z-compressed");

        return contentTypeMap.getOrDefault(extension, "application/octet-stream");
    }

}
