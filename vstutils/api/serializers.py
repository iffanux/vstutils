# pylint: disable=no-member,unused-argument
from __future__ import unicode_literals

import json
import six

from django.contrib.auth.models import User, models
from rest_framework import serializers, exceptions
from . import fields


class BaseSerializer(serializers.Serializer):
    # pylint: disable=abstract-method
    pass


class VSTSerializer(serializers.ModelSerializer):
    # pylint: disable=abstract-method
    serializer_field_mapping = serializers.ModelSerializer.serializer_field_mapping
    serializer_field_mapping.update({
        models.CharField: fields.VSTCharField,
        models.TextField: fields.VSTCharField,
    })


class EmptySerializer(serializers.Serializer):

    def create(self, validated_data):  # nocv
        return validated_data

    def update(self, instance, validated_data):  # nocv
        return instance



class DataSerializer(EmptySerializer):

    def to_internal_value(self, data):  # nocv
        return (
            data
            if (
                isinstance(data, (six.string_types, six.text_type)) or
                isinstance(data, (dict, list))
            )
            else self.fail("Unknown type.")
        )

    def to_representation(self, value):  # nocv
        return (
            json.loads(value)
            if not isinstance(value, (dict, list))
            else value
        )


class JsonObjectSerializer(DataSerializer):
    pass


class ErrorSerializer(DataSerializer):
    detail = fields.VSTCharField(required=True)

    def to_internal_value(self, data):
        return data

    def to_representation(self, value):
        return value


class ValidationErrorSerializer(ErrorSerializer):
    detail = serializers.DictField(required=True)


class OtherErrorsSerializer(ErrorSerializer):
    error_type = fields.VSTCharField(required=False, allow_null=True)


class UserSerializer(VSTSerializer):
    is_active = serializers.BooleanField(default=True)
    is_staff = serializers.BooleanField(default=False)
    email = serializers.EmailField(required=False)

    class UserExist(exceptions.ValidationError):
        status_code = 409

    class Meta:
        model = User
        fields = ('id',
                  'username',
                  'is_active',
                  'is_staff',
                  'email',)
        read_only_fields = ('is_superuser',)

    def create(self, data):
        if not self.context['request'].user.is_staff:
            raise exceptions.PermissionDenied  # nocv
        valid_fields = ['username', 'password', 'is_active', 'is_staff',
                        "email", "first_name", "last_name"]
        creditals = {d: data[d] for d in valid_fields
                     if data.get(d, None) is not None}
        raw_passwd = self.initial_data.get("raw_password", "False")
        user = super(UserSerializer, self).create(creditals)
        if not raw_passwd == "True":
            user.set_password(creditals['password'])
            user.save()
        return user

    def is_valid(self, raise_exception=False):
        if self.instance is None:
            try:
                initial_data = self.initial_data
                User.objects.get(username=initial_data.get('username', None))
                raise self.UserExist({'username': ["Already exists."]})
            except User.DoesNotExist:
                pass
        return super(UserSerializer, self).is_valid(raise_exception)

    def update(self, instance, validated_data):
        if not self.context['request'].user.is_staff and instance.id != self.context['request'].user.id:
            # can't be tested because PATCH from non privileged user to other
            # user fails at self.get_object() in View
            raise exceptions.PermissionDenied  # nocv
        instance.username = validated_data.get('username', instance.username)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.is_staff = validated_data.get('is_staff', instance.is_staff)
        instance.save()
        return instance


class OneUserSerializer(UserSerializer):

    class Meta:
        model = User
        fields = ('id',
                  'username',
                  'is_active',
                  'is_staff',
                  'first_name',
                  'last_name',
                  'email',)
        read_only_fields = ('is_superuser',
                            'date_joined',)


class CreateUserSerializer(OneUserSerializer):
    password = fields.VSTCharField(write_only=True)
    password2 = fields.VSTCharField(write_only=True, label='Repeat password')

    class Meta(OneUserSerializer.Meta):
        fields = list(OneUserSerializer.Meta.fields) + ['password', 'password2']

    def run_validation(self, data=serializers.empty):
        validated_data = super(CreateUserSerializer, self).run_validation(data)
        if validated_data['password'] != validated_data.pop('password2', None):
            raise exceptions.ValidationError('Passwords do not match.')
        return validated_data


class ChangePasswordSerializer(DataSerializer):
    old_password = serializers.CharField(required=True)
    password = serializers.CharField(required=True, label='New password')
    password2 = serializers.CharField(required=True, label='Confirm new password')

    def update(self, instance, validated_data):
        if not instance.check_password(validated_data['old_password']):
            raise exceptions.PermissionDenied('Password is not correct.')
        if validated_data['password'] != validated_data['password2']:
            raise exceptions.ValidationError("New passwords' values are not equal.")
        instance.set_password(validated_data['password'])
        instance.save()
        return instance

    def to_representation(self, value):
        return dict(
            old_password='***',
            password='***',
            password2='***',
        )
