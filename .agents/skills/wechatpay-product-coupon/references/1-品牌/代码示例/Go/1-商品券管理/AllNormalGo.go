package main

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/brand_models_and_client.go
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import (
	"demo/wxpay_brand_utility" // 引用微信支付工具库
	"fmt"
)

// 创建商品券 - 单券-全场-满减券
func main() {
	// TODO: 请准备商户开发必要参数
	config, err := wxpay_brand_utility.CreateBrandConfig(
		"xxxxxxxx",                   // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考
		"1DDE55AD98Exxxxxxxxxx",      // 品牌API证书序列号，如何获取请参考品牌经营平台【安全中心】
		"/path/to/apiclient_key.pem", // 品牌API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考品牌经营平台【安全中心】
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CreateProductCouponRequest{
		OutRequestNo: wxpay_brand_utility.String("12345_20250101_A3489"), // 必填，创建请求单号，6-40个字符
		Scope:        PRODUCTCOUPONSCOPE_ALL.Ptr(),                       // 必填，优惠范围：ALL-全场券
		Type:         PRODUCTCOUPONTYPE_NORMAL.Ptr(),                     // 必填，商品券类型：NORMAL-满减券
		UsageMode:    USAGEMODE_SINGLE.Ptr(),                             // 必填，使用模式：SINGLE-单券
		// 条件必填，单券模式信息(当usage_mode=SINGLE且scope=ALL时，需填写优惠规则)
		SingleUsageInfo: &SingleUsageInfo{
			// 条件必填，满减券使用规则(当type=NORMAL且scope=ALL时必填)
			NormalCoupon: &NormalCouponUsageRule{
				Threshold:      wxpay_brand_utility.Int64(20000), // 必填，门槛金额(单位：分)，满200元可用
				DiscountAmount: wxpay_brand_utility.Int64(5000),  // 必填，固定减免金额(单位：分)，减50元
			},
		},
		// 必填，商品券展示信息
		DisplayInfo: &ProductCouponDisplayInfo{
			Name:          wxpay_brand_utility.String("全场满200减50"),                              // 必填，商品券名称，最多12个字符
			ImageUrl:      wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 必填，商品券图片URL
			BackgroundUrl: wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，背景图URL
			DetailImageUrlList: []string{ // 选填，详情图URL列表，最多6张
				"https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx",
			},
		},
		OutProductNo: wxpay_brand_utility.String("Product_1234567890"), // 选填，商户侧商品券唯一标识
		// 条件必填，批次信息(当usage_mode=SINGLE时必填)
		Stock: &StockForCreate{
			Remark:         wxpay_brand_utility.String("8月工作日有效批次"), // 选填，批次备注，最多60个字符
			CouponCodeMode: COUPONCODEMODE_UPLOAD.Ptr(),           // 必填，券码模式：WECHATPAY/UPLOAD/API_ASSIGN
			// 必填，批次发放规则
			StockSendRule: &StockSendRule{
				MaxCount:        wxpay_brand_utility.Int64(10000000), // 必填，批次最大发放数量
				MaxCountPerDay:  wxpay_brand_utility.Int64(100000),   // 选填，单日最大发放数量
				MaxCountPerUser: wxpay_brand_utility.Int64(1),        // 必填，单用户最大领取数量
			},
			// 条件必填，单券使用规则(当usage_mode=SINGLE时必填)
			SingleUsageRule: &SingleUsageRule{
				// 必填，券可核销时间
				CouponAvailablePeriod: &SingleCouponAvailablePeriod{
					AvailableBeginTime:   wxpay_brand_utility.String("2025-08-01T00:00:00+08:00"), // 必填，可用开始时间(RFC3339格式)
					AvailableEndTime:     wxpay_brand_utility.String("2025-08-31T23:59:59+08:00"), // 必填，可用结束时间(RFC3339格式)
					AvailableDays:        wxpay_brand_utility.Int64(30),                          // 选填，领取后有效天数
					WaitDaysAfterReceive: wxpay_brand_utility.Int64(0),                           // 选填，领取后等待天数
					// 选填，每周固定可用时间
					WeeklyAvailablePeriod: &FixedWeekPeriod{
						DayList: []WeekEnum{ // 条件必填，每周可用星期数
							WEEKENUM_MONDAY,
							WEEKENUM_TUESDAY,
							WEEKENUM_WEDNESDAY,
							WEEKENUM_THURSDAY,
							WEEKENUM_FRIDAY,
						},
					},
					// 选填，不规则可用时间段列表
					IrregularAvailablePeriodList: []TimePeriod{
						{
							BeginTime: wxpay_brand_utility.String("2025-08-15T00:00:00+08:00"), // 必填，开始时间(RFC3339格式)
							EndTime:   wxpay_brand_utility.String("2025-08-15T23:59:59+08:00"), // 必填，结束时间(RFC3339格式)
						},
					},
				},
			},
			// 必填，使用规则展示信息
			UsageRuleDisplayInfo: &UsageRuleDisplayInfo{
				CouponUsageMethodList: []CouponUsageMethod{ // 必填，核销方式列表
					COUPONUSAGEMETHOD_OFFLINE,      // 线下核销
					COUPONUSAGEMETHOD_MINI_PROGRAM, // 小程序核销
					COUPONUSAGEMETHOD_APP,          // APP核销
					COUPONUSAGEMETHOD_PAYMENT_CODE, // 付款码核销
				},
				MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),        // 条件必填，支持小程序核销时必填
				MiniProgramPath:  wxpay_brand_utility.String("/pages/index/product"), // 条件必填，支持小程序核销时必填
				AppPath:          wxpay_brand_utility.String("pages/index/product"),  // 条件必填，支持APP核销时必填
				UsageDescription: wxpay_brand_utility.String("工作日可用"),               // 选填，使用说明
				// 选填，可用门店信息
				CouponAvailableStoreInfo: &CouponAvailableStoreInfo{
					Description:      wxpay_brand_utility.String("所有门店可用，可使用小程序查看门店列表"), // 选填，可用门店描述
					MiniProgramAppid: wxpay_brand_utility.String("wx1234567890"),          // 选填，门店小程序AppID
					MiniProgramPath:  wxpay_brand_utility.String("/pages/index/store-list"), // 选填，门店小程序路径
				},
			},
			// 必填，用户券展示信息
			CouponDisplayInfo: &CouponDisplayInfo{
				CodeDisplayMode: COUPONCODEDISPLAYMODE_QRCODE.Ptr(),      // 必填，券码展示模式：INVISIBLE/BARCODE/QRCODE
				BackgroundColor: wxpay_brand_utility.String("Color010"), // 选填，背景颜色
				// 选填，小程序入口
				EntranceMiniProgram: &EntranceMiniProgram{
					Appid:           wxpay_brand_utility.String("wx1234567890"),         // 必填，小程序AppID
					Path:            wxpay_brand_utility.String("/pages/index/product"), // 必填，小程序路径
					EntranceWording: wxpay_brand_utility.String("欢迎选购"),                 // 必填，入口文案
					GuidanceWording: wxpay_brand_utility.String("获取更多优惠"),               // 选填，引导文案
				},
				// 选填，公众号入口
				EntranceOfficialAccount: &EntranceOfficialAccount{
					Appid: wxpay_brand_utility.String("wx1234567890"), // 必填，公众号AppID
				},
				// 选填，视频号入口
				EntranceFinder: &EntranceFinder{
					FinderId:                 wxpay_brand_utility.String("gh_12345678"),                             // 必填，视频号ID
					FinderVideoId:            wxpay_brand_utility.String("UDFsdf24df34dD456Hdf34"),                  // 选填，视频号视频ID
					FinderVideoCoverImageUrl: wxpay_brand_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"), // 选填，视频封面图URL
				},
			},
			// 选填，事件通知配置
			NotifyConfig: &NotifyConfig{
				NotifyAppid: wxpay_brand_utility.String("wx4fd12345678"), // 必填，通知AppID
			},
			StoreScope: STOCKSTORESCOPE_NONE.Ptr(), // 必填，门店适用范围：NONE-不限制/ALL-全部门店/SPECIFIC-指定门店
		},
	}

	response, err := CreateProductCoupon(config, request)
	if err != nil {
		fmt.Printf("全场满减券创建失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("全场满减券创建成功: %+v\n", response)
}
