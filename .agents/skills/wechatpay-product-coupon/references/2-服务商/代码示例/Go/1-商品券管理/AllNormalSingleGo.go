package main

// SDK工具类（HTTP客户端 + 数据模型）见: ../9-SDK工具类/service_models_and_client.go
// ❗重要：本文件为官方示例代码，只允许替换参数和添加注释，禁止从零编写或拼接修改API路径、签名逻辑、请求结构

import (
	"demo/wxpay_utility" // 引用微信支付工具库
	"encoding/json"
	"fmt"
)

// 场景2：创建商品券 - 单券-全场-满减券
//
// 场景说明：
// - usage_mode: SINGLE（单券模式）
// - scope: ALL（全场券）
// - type: NORMAL（满减券）
//
// 优惠规则配置位置：single_usage_info.normal_coupon（全场券在single_usage_info中配置）
//
func main() {
	// TODO: 请准备商户开发必要参数
	config, err := wxpay_utility.CreateMchConfig(
		"19xxxxxxxx",                 // 商户号，是由微信支付系统生成并分配给每个商户的唯一标识符，商户号获取方式参考商户平台
		"1DDE55AD98Exxxxxxxxxx",      // 商户API证书序列号，如何获取请参考商户平台【API安全】
		"/path/to/apiclient_key.pem", // 商户API证书私钥文件路径，本地文件路径
		"PUB_KEY_ID_xxxxxxxxxxxxx",   // 微信支付公钥ID，如何获取请参考商户平台【API安全】
		"/path/to/wxp_pub.pem",       // 微信支付公钥文件路径，本地文件路径
	)
	if err != nil {
		fmt.Println(err)
		return
	}

	request := &CreateProductCouponRequest{
		// ==================== 一级参数 ====================
		// 必填：创建请求单号，品牌侧需保持唯一性，6-40个字符
		OutRequestNo: wxpay_utility.String("SINGLE_ALL_NORMAL_20250101_002"),
		// 必填：品牌ID
		BrandId: wxpay_utility.String("120344"),
		// 必填：优惠范围，ALL=全场券
		Scope: PRODUCTCOUPONSCOPE_ALL.Ptr(),
		// 必填：商品券类型，NORMAL=满减券
		Type: PRODUCTCOUPONTYPE_NORMAL.Ptr(),
		// 必填：使用模式，SINGLE=单券模式
		UsageMode: USAGEMODE_SINGLE.Ptr(),
		// 选填：外部商品ID
		OutProductNo: wxpay_utility.String("Product_SINGLE_002"),

		// ==================== 单券模式优惠信息（scope=ALL时在此配置优惠规则） ====================
		SingleUsageInfo: &SingleUsageInfo{
			// 当type=NORMAL且scope=ALL时必填：满减券使用规则
			NormalCoupon: &NormalCouponUsageRule{
				// 必填：门槛金额，单位为分，0表示无门槛。满100元可用填10000
				Threshold: wxpay_utility.Int64(10000),
				// 必填：固定减免金额，单位为分，减15元填1500
				DiscountAmount: wxpay_utility.Int64(1500),
			},
		},

		// ==================== 展示信息（必填） ====================
		DisplayInfo: &ProductCouponDisplayInfo{
			// 必填：商品券名称，最多20个字符
			Name: wxpay_utility.String("全场满100减15"),
			// 必填：商品图片URL，需通过图片上传接口获取
			ImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"),
			// 必填：背景图URL
			BackgroundUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"),
			// 选填：详情图URL列表
			DetailImageUrlList: []string{
				"https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx",
			},
		},

		// ==================== 批次信息（必填） ====================
		Stock: &StockForCreate{
			// 选填：备注
			Remark: wxpay_utility.String("8月工作日有效批次"),
			// 必填：券Code分配模式，WECHATPAY=微信支付生成
			CouponCodeMode: COUPONCODEMODE_WECHATPAY.Ptr(),

			// ---------- 发放规则（必填） ----------
			StockSendRule: &StockSendRule{
				// 必填：总发放次数上限
				MaxCount: wxpay_utility.Int64(10000000),
				// 选填：每日发放上限
				MaxCountPerDay: wxpay_utility.Int64(100000),
				// 必填：每用户领取上限
				MaxCountPerUser: wxpay_utility.Int64(1),
			},

			// ---------- 单券使用规则（当usage_mode=SINGLE时必填） ----------
			// 注意：scope=ALL时，优惠规则在single_usage_info中配置，此处只配置券可核销时间
			SingleUsageRule: &SingleUsageRule{
				// 券可核销时间（必填）
				CouponAvailablePeriod: &CouponAvailablePeriod{
					// 必填：开始时间，RFC3339格式
					AvailableBeginTime: wxpay_utility.String("2025-08-01T00:00:00+08:00"),
					// 必填：结束时间
					AvailableEndTime: wxpay_utility.String("2025-08-31T23:59:59+08:00"),
					// 选填：生效后N天有效，最多365天
					AvailableDays: wxpay_utility.Int64(30),
					// 选填：领取后N天生效，最多30天，0表示立即生效
					WaitDaysAfterReceive: wxpay_utility.Int64(0),
					// 选填：每周可用时间
					WeeklyAvailablePeriod: &FixedWeekPeriod{
						// 当配置weekly_available_period时必填：可用星期列表
						DayList: []WeekEnum{
							WEEKENUM_MONDAY,
							WEEKENUM_TUESDAY,
							WEEKENUM_WEDNESDAY,
							WEEKENUM_THURSDAY,
							WEEKENUM_FRIDAY,
						},
					},
				},
			},

			// ---------- 使用规则展示信息（必填） ----------
			UsageRuleDisplayInfo: &UsageRuleDisplayInfo{
				// 必填：券使用方式列表
				CouponUsageMethodList: []CouponUsageMethod{
					COUPONUSAGEMETHOD_OFFLINE,      // 线下滴码核销
					COUPONUSAGEMETHOD_MINI_PROGRAM, // 线上小程序核销
					COUPONUSAGEMETHOD_PAYMENT_CODE, // 微信支付付款码核销
				},
				// 当coupon_usage_method_list包含MINI_PROGRAM时必填：核销小程序AppID
				MiniProgramAppid: wxpay_utility.String("wx1234567890"),
				// 当coupon_usage_method_list包含MINI_PROGRAM时必填：核销小程序路径
				MiniProgramPath: wxpay_utility.String("/pages/index/product"),
				// 必填：使用说明
				UsageDescription: wxpay_utility.String("工作日可用"),
				// 选填：可用门店信息
				CouponAvailableStoreInfo: &CouponAvailableStoreInfo{
					// 当配置coupon_available_store_info时必填：门店描述
					Description: wxpay_utility.String("所有门店可用，可使用小程序查看门店列表"),
					// 选填：查看门店的小程序AppID
					MiniProgramAppid: wxpay_utility.String("wx1234567890"),
					// 选填：查看门店的小程序路径
					MiniProgramPath: wxpay_utility.String("/pages/index/store-list"),
				},
			},

			// ---------- 用户券展示信息（必填） ----------
			CouponDisplayInfo: &CouponDisplayInfo{
				// 必填：Code展示模式，QRCODE=二维码
				CodeDisplayMode: COUPONCODEDISPLAYMODE_QRCODE.Ptr(),
				// 选填：背景颜色
				BackgroundColor: wxpay_utility.String("Color010"),
				// 选填：小程序入口
				EntranceMiniProgram: &EntranceMiniProgram{
					Appid:           wxpay_utility.String("wx1234567890"),
					Path:            wxpay_utility.String("/pages/index/product"),
					EntranceWording: wxpay_utility.String("欢迎选购"),
					GuidanceWording: wxpay_utility.String("获取更多优惠"),
				},
				// 选填：公众号入口
				EntranceOfficialAccount: &EntranceOfficialAccount{
					Appid: wxpay_utility.String("wx1234567890"),
				},
				// 选填：视频号入口
				EntranceFinder: &EntranceFinder{
					FinderId:                 wxpay_utility.String("gh_12345678"),
					FinderVideoId:            wxpay_utility.String("UDFsdf24df34dD456Hdf34"),
					FinderVideoCoverImageUrl: wxpay_utility.String("https://wxpaylogo.qpic.cn/wxpaylogo/xxxxx/xxx"),
				},
			},

			// ---------- 事件通知配置（必填） ----------
			NotifyConfig: &NotifyConfig{
				// 必填：事件通知AppID
				NotifyAppid: wxpay_utility.String("wx4fd12345678"),
			},

			// 必填：可用门店范围，NONE=不限制
			StoreScope: STOCKSTORESCOPE_NONE.Ptr(),
		},
	}

	response, err := CreateProductCoupon(config, request)
	if err != nil {
		fmt.Printf("请求失败: %+v\n", err)
		// TODO: 请求失败，根据状态码执行不同的处理
		return
	}

	// TODO: 请求成功，继续业务逻辑
	fmt.Printf("请求成功: %+v\n", response)
}
